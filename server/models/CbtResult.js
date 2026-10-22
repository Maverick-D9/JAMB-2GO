const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, '..', 'cbt-results.json');

if (!fs.existsSync(FILE_PATH)) {
  fs.writeFileSync(FILE_PATH, JSON.stringify([], null, 2));
}

function loadAll() {
  try { return JSON.parse(fs.readFileSync(FILE_PATH, 'utf8')); }
  catch { return []; }
}
function saveAll(data) {
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
}

class CbtResult {
  static async create(doc) {
    const all = loadAll();
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const newDoc = {
      _id: id,
      userId: doc.userId || doc.username || 'Anonymous',
      name: doc.name || doc.userId || 'Anonymous',
      date: doc.date || new Date().toISOString(),
      totalScore: doc.totalScore || 0,
      englishScore: doc.englishScore || 0,
      subject2Name: doc.subject2Name || '',
      subject2Score: doc.subject2Score || 0,
      subject3Name: doc.subject3Name || '',
      subject3Score: doc.subject3Score || 0,
      subject4Name: doc.subject4Name || '',
      subject4Score: doc.subject4Score || 0,
      rawScore: doc.rawScore || doc.totalScore || 0,
      rawTotal: doc.rawTotal || 400,
      subjects: doc.subjects || [],
      timeTaken: doc.timeTaken || 0,
      isFlagged: doc.isFlagged || false,
      // === STEP 1: REVIEW ===
      attemptId: doc.attemptId || id,
      userAnswers: doc.userAnswers || {},
      questionsSnapshot: doc.questionsSnapshot || null,
      // === END STEP 1 ===
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    all.push(newDoc);
    saveAll(all);
    return newDoc;
  }

  constructor(doc) {
    Object.assign(this, doc);
  }
  async save() {
    return CbtResult.create(this);
  }

  static async find(filter = {}) {
    let all = loadAll();
    if (filter.userId) all = all.filter(r => r.userId === filter.userId);
    if (filter.isFlagged!== undefined) all = all.filter(r => r.isFlagged === filter.isFlagged);
    if (filter.attemptId) all = all.filter(r => r.attemptId === filter.attemptId || r._id === filter.attemptId);
    return all;
  }

  static async findOne(filter = {}) {
    const res = await this.find(filter);
    return res[0] || null;
  }

  static async getLeaderboard(limit = 100) {
    const all = loadAll().filter(r =>!r.isFlagged);
    const best = {};
    all.forEach(r => {
      const id = r.userId;
      if (!best[id] || r.totalScore > best[id].totalScore ||
         (r.totalScore === best[id].totalScore && r.timeTaken < best[id].timeTaken)) {
        best[id] = r;
      }
    });
    return Object.values(best)
   .sort((a, b) => {
        if (b.totalScore!== a.totalScore) return b.totalScore - a.totalScore;
        return a.timeTaken - b.timeTaken;
      })
   .slice(0, limit);
  }

  static async deleteAll() {
    saveAll([]);
  }

  static async deleteMany() {
    saveAll([]);
  }

  static findById(id) {
    const all = loadAll();
    return all.find(r => r._id === id || r.attemptId === id) || null;
  }
}

module.exports = CbtResult;