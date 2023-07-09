const express = require('express');
const cors = require('cors');
const mongoose = require("mongoose");
const User = require('./models/User');
const Post = require('./models/Post');
const bcrypt = require('bcryptjs');
const dotenv = require ('dotenv');
const slugify = require('slugify');
const app = express();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const uploadMiddleware = multer({ dest: 'uploads/' });
const fs = require('fs');
const process.env.Port || 5000
const salt = bcrypt.genSaltSync(10);
const secret = 'asdfe45we45w345fhgfhfh675654876@@#$#$wegw345werjktjwertkj';
dotenv.config();
app.use(cors({credentials:true,origin:'http://localhost:3000'}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));



mongoose.connect(process.env.CONNECT_DB, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => {
    console.log("Database is perfectly connected");
  })
  .catch((err) => {
    console.error(err);
  });


app.post('/register', async (req,res) => {
  const {username,name, email,password} = req.body;
  try{
    const userDoc = await User.create({
      username,
      name,
      email,
      password:bcrypt.hashSync(password,salt),
    });
    res.json(userDoc);
  } catch(e) {
    console.log(e);
    res.status(400).json(e);
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const userDoc = await User.findOne({ username });
    if (!userDoc) {
      return res.status(400).json('User not found');
    }
    const passOk = bcrypt.compareSync(password, userDoc.password);
    if (passOk) {
      // logged in
      jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
        if (err) throw err;
        res.cookie('token', token).json({
          id: userDoc._id,
          username,
        });
      });
    } else {
      return res.status(400).json('Wrong credentials');
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json('Internal server error');
  }
});

app.get('/profile', (req,res) => {
  const {token} = req.cookies;
  jwt.verify(token, secret, {}, (err,info) => {
    if (err) throw err;
    res.json(info);
  });
});

app.post('/logout', (req,res) => {
  res.cookie('token', '').json('ok');
});

app.post('/post', uploadMiddleware.single('file'), async (req, res) => {
  const { originalname, path } = req.file;
  const parts = originalname.split('.');
  const ext = parts[parts.length - 1];
  const newPath = path + '.' + ext;
  fs.renameSync(path, newPath);

  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;
    const { title, summary, content,tag } = req.body;
    const slug = slugify(title, { lower: true });

    const postDoc = await Post.create({
      title,
      summary,
      content,
      cover: newPath,
      author: info.id,
      slug: slug,
      tag
    });
    res.json(postDoc);
  });
});

app.put('/post', uploadMiddleware.single('file'), async (req, res) => {
  let newPath = null;
  if (req.file) {
    const { originalname, path } = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    newPath = path + '.' + ext;
    fs.renameSync(path, newPath);
  }

  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;
    const { id, title, summary, content, tag } = req.body;
    const postDoc = await Post.findById(id);
    const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
    if (!isAuthor) {
      return res.status(400).json('you are not the author');
    }

    const slug = slugify(title, { lower: true });
    await postDoc.update({
      title,
      summary,
      content,
      cover: newPath ? newPath : postDoc.cover,
      slug: slug,
      tag
    });

    res.json(postDoc);
  });
});


app.get('/post', async (req, res) => {
  const posts = await Post.find()
    .populate('author', ['username'])
    .sort({ createdAt: -1 })
    .limit(20);

  // Map the posts to include the slug in the response
  const formattedPosts = posts.map((post) => ({
    ...post.toObject(),
    slug: post.slug, // Include the slug in the response
  }));

  res.json(formattedPosts);
});



app.get('/post/:slug', async (req, res) => {
  const { slug } = req.params;
  const postDoc = await Post.findOne({ slug }).populate('author', ['username']);
  res.json(postDoc);
});

app.delete('/post/:id', async (req, res) => {
  const { id } = req.params;
  const { token } = req.cookies;

  try {
    jwt.verify(token, secret, {}, async (err, info) => {
      if (err) throw err;

      const postDoc = await Post.findById(id);
      const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);

      if (!isAuthor) {
        return res.status(400).json('You are not the author');
      }

      // Delete the post and remove the associated cover image
      await postDoc.deleteOne();
      if (postDoc.cover) {
        fs.unlinkSync(postDoc.cover);
      }

      res.json('Post deleted successfully');
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json('Internal server error');
  }
});



app.listen(process.env.PORT,()=>{
  console.log(`http://localhost:${process.env.PORT}`)
});
//