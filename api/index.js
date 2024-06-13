const express = require('express');
const cors = require('cors');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const mongoClient=require('mongodb').MongoClient;
const imageDownloader = require('image-downloader');
const multer = require('multer');
const fs = require('fs');
const {S3Client, PutObjectCommand} = require('@aws-sdk/client-s3');
const mime = require('mime-types');
const path = require('path');
const { ObjectId } = require('mongodb');

require('dotenv').config();
const app = express();

const jwtSecret = 'vinay';

app.use(express.json())
app.use(cookieParser());
app.use(cors({
  credentials:true,
  origin:'http://localhost:5173'
}));


// Connect to db
mongoClient.connect('mongodb://localhost:27017')
.then(client=>{
  // get db obj
  const bookingdb=client.db('bookingdb')
  // get collection obj
  const users = bookingdb.collection('users')
  const places = bookingdb.collection('places')
  const bookings = bookingdb.collection('bookings')
  // share collection with obj with express app
  app.set('users',users)
  app.set('places',places)
  app.set('bookings',bookings)
  // confirm db connection status
  console.log("DB connection success")
})
.catch(err=>console.log("Err in DB connection",err))

app.use((req, res, next) => {
  users = req.app.get('users')
  places = req.app.get('places')
  bookings = req.app.get('bookings')
  next()
})

function getUserDataFromReq(req) {
  return new Promise((resolve, reject) => {
    jwt.verify(req.cookies.token, jwtSecret, {}, async (err, userData) => {
      if (err) throw err;
      resolve(userData);
    });
  });
}

app.get('/test', (req,res)=>{
  res.json('test ok');
})

app.post('/register', async(req,res)=>{
  // get user resource from client
  const newUser = req.body;
  // console.log(newUser)
  // check for duplicate user based on username
  const dbUser = await users.findOne({ email: newUser.email })
  // if user found in db
  if (dbUser !== null) {
    res.send({ message: "user existed" })
  } else {
    // hash the password
    const hashedPassword = await bcryptjs.hash(newUser.password, 6)
    // replace the password with hashed password
    newUser.password = hashedPassword
    // create user
    const dbres = await users.insertOne(newUser)
    // send res
    if (dbres.acknowledged === true) {
      res.send({ message: 'user created' })
    } else {
      res.send({ message: 'Try again, user not created' })
    }
  }
})

app.post('/login', async(req,res)=>{
    // get cred obj from client
    const userCred=req.body
    // check the user name
    const dbUser = await users.findOne({email:userCred.email})
    if(dbUser===null){
      res.send({message:'Invalid email'})
    }
    // check password
    else{
      const status = await bcryptjs.compare(userCred.password,dbUser.password)
      if(status===false){
        res.send({message:'Invalid password'})
      }else{
        // create jwt web token and encode it
        const signedToken = jwt.sign({email:dbUser.email,id:dbUser._id},'vinay',{})
        // send res
        res.cookie('token',signedToken).send({message:'login success',user:dbUser})
      }
  
    }
})

app.get('/profile', (req,res) => {
  const {token} = req.cookies;
  if (token) {
    jwt.verify(token, 'vinay', {}, async (err, userData) => {
      if (err) throw err;
      const {name,email,_id} = await users.findOne({email:userData.email});
      res.json({name,email,_id});
    });
  } else {
    res.json(null);
  }
});

app.post('/logout', (req,res) => {
  res.cookie('token', '').json(true);
});

const uploadDirectory = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadDirectory));

app.post('/upload-by-link', async (req, res) => {
  const { link } = req.body;
  const newName = 'photo' + Date.now() + '.jpg';
  await imageDownloader.image({
    url: link,
    dest: path.join(uploadDirectory, newName),
  });
  res.json(newName);
});

const photosMiddleware = multer({ dest: '/tmp' });
app.post('/upload', photosMiddleware.array('photos', 100), async (req, res) => {
  const uploadedFiles = [];
  for (let i = 0; i < req.files.length; i++) {
    const { path, originalname, mimetype } = req.files[i];
    const url = await uploadToS3(path, originalname, mimetype);
    uploadedFiles.push(url);
  }
  res.json(uploadedFiles);
});

app.post('/places', (req, res) => {
  const { token } = req.cookies;
  const {
    title, address, addedPhotos, description, price,
    perks, extraInfo, checkIn, checkOut, maxGuests,
  } = req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const placeDoc = await places.insertOne({
      owner: userData.id, price,
      title, address, photos: addedPhotos, description,
      perks, extraInfo, checkIn, checkOut, maxGuests,
    });
    res.json(placeDoc);
  });
});

app.get('/user-places', (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    const { id } = userData;
    res.json(await places.find({ owner: id }).toArray());
  });
});

app.get('/places/:id', async (req, res) => {
  const { id } = req.params;
  const place=await places.findOne({_id: new ObjectId(id)})
  res.send(place)
});

app.put('/places', async (req, res) => {
  const { token } = req.cookies;
  const {
    id, title, address, addedPhotos, description,
    perks, extraInfo, checkIn, checkOut, maxGuests, price,
  } = req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    if (err) throw err;
    const placeDoc = await places.findOne({ _id: new ObjectId(id) });
    if (userData.id === placeDoc.owner.toString()) {
      await places.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            title, address, photos: addedPhotos, description,
            perks, extraInfo, checkIn, checkOut, maxGuests, price,
          }
        }
      );
      res.json('ok');
    }
  });
});

app.get('/places', async (req, res) => {
  res.json(await places.find().toArray());
});

app.post('/bookings', async (req, res) => {
  const userData = await getUserDataFromReq(req);
  const {
    place, checkIn, checkOut, numberOfGuests, name, phone, price,
  } = req.body;
    const placeObject = await places.findOne({ _id: new ObjectId(place) });
    if (!placeObject) {
      return res.status(404).json({ error: 'Place not found' });
    }
  bookings.insertOne({
    place:placeObject, checkIn, checkOut, numberOfGuests, name, phone, price,
    user: userData.id,
  }).then((doc) => {
    res.json(doc);
  }).catch((err) => {
    throw err;
  });
});

app.get('/bookings', async (req, res) => {
  const userData = await getUserDataFromReq(req);
  res.json(await bookings.find({ user: userData.id }).toArray());
});

app.listen(4000,()=>console.log('Web server on port 4000'))