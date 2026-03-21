const mongoose = require('mongoose');

const ContractAnalysisSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  chain: {
    type: String,
    default: 'avalanche',
    enum: ['avalanche']
  },
  language: {
    type: String,
    default: 'en',
    enum: ['en', 'es']
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  level: {
    type: String,
    required: true,
    enum: ['Low', 'Medium', 'High']
  },
  warnings: [{
    type: String
  }],
  explanation: {
    type: String,
    default: null
  },
  signals: {
    contract_verified: { type: Boolean, default: false },
    has_mint_function: { type: Boolean, default: false },
    has_blacklist_function: { type: Boolean, default: false },
    has_pause_function: { type: Boolean, default: false },
    ownership_renounced: { type: Boolean, default: false },
    has_transfer_restrictions: { type: Boolean, default: false },
    holder_concentration_top1: { type: Number, default: 0 },
    holder_concentration_top10: { type: Number, default: 0 },
    liquidity_pool_age_days: { type: Number, default: null },
    liquidity_amount_usd: { type: Number, default: null },
    is_proxy: { type: Boolean, default: false }
  },
  report_ipfs_url: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

ContractAnalysisSchema.index({ address: 1, language: 1 }, { unique: true });
ContractAnalysisSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

ContractAnalysisSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('ContractAnalysis', ContractAnalysisSchema);
