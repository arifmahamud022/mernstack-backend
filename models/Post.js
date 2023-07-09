const mongoose = require('mongoose');
const slugify = require('slugify');
const {Schema,model} = mongoose;

const PostSchema = new Schema({
  title:String,
  summary:String,
  content:String,
  cover:String,
  author:{type:Schema.Types.ObjectId, ref:'User'},
  tag:String,
  slug: {
    type: String,
    unique: true
  },
}, {
  timestamps: true,
});

const PostModel = model('Post', PostSchema);
PostSchema.pre('save', function (next) {
  this.slug = slugify(this.title, { lower: true });
  next();
});
module.exports = PostModel;