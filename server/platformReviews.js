const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  role: { type: String, required: true },
  account: { type: mongoose.Schema.Types.ObjectId, required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, maxlength: 600, required: true },
  shared: { type: Boolean, default: false },
}, { timestamps: true });
schema.index({ role: 1, account: 1 }, { unique: true });
const Review = mongoose.model("PlatformReview", schema);

module.exports = function registerReviews(app, guards) {
  for (const [role, guard] of Object.entries(guards)) {
    const path = "/api/platform-reviews/" + role + "/mine";
    const owner = req => ({ role, account: req[role + "Id"] });
    app.get(path, guard, async (req, res) => {
      res.set("Cache-Control", "no-store").json(await Review.findOne(owner(req)).select("rating comment shared -_id"));
    });
    app.put(path, guard, async (req, res) => {
      const { rating, comment, shared } = req.body || {};
      if (!Number.isInteger(rating) || rating < 1 || rating > 5 || typeof shared !== "boolean" ||
          typeof comment !== "string" || !comment.trim() || comment.trim().length > 600) {
        return res.status(400).json({ message: "Choose a rating and enter up to 600 characters." });
      }
      await Review.updateOne(owner(req), { $set: { rating, comment: comment.trim(), shared } }, { upsert: true, runValidators: true });
      res.sendStatus(204);
    });
    app.delete(path, guard, async (req, res) => {
      await Review.deleteOne(owner(req));
      res.sendStatus(204);
    });
  }
  app.get("/api/platform-reviews/public", async (_req, res) => {
    res.set("Cache-Control", "no-store").json(await Review.find({ shared: true }).sort({ updatedAt: -1 }).limit(6).select("role rating comment"));
  });
};
