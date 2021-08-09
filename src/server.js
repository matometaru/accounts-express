const express = require('express');
const cors = require('cors');
const firebaseAdmin = require('firebase-admin');
const path = require('path');
const session = require('express-session');

const app = express();
const corsOptions = {
  origin: ['http://localhost:3000', 'http://localhost:80801'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use('/', express.static(path.join(__dirname, 'public')));
app.use(express.static('statics'))
app.set("trust proxy", 1);
app.use(session({
  secret: "secret",
  domain: "localhost",
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 30 * 60 * 1000 }
}));

const app1ServiceAccount = require('../firebase/app1/firebase-key.js');
const app2ServiceAccount = require('../firebase/app2/firebase-key.js');

const app1 = firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(app1ServiceAccount),
  databaseURL: `https://${app1ServiceAccount.project_id}.firebaseio.com`
}, 'app1');
const app2 = firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(app2ServiceAccount),
  databaseURL: `https://${app2ServiceAccount.project_id}.firebaseio.com`
}, 'app2');

// GET: /checkAuthentication
app.get('/checkAuthentication', async (req, res) => {
  const idToken = getIdToken(req);
  req.session.__session = idToken;
});

// GET: customToken
app.get('/customToken', async (req, res) => {
  const idToken = req.session.__session;
  try {
    const { uid } = await app1.auth().verifyIdToken(idToken);
    const firebaseToken = await createCustomToken(req, uid);
    res.json({firebaseToken});
  } catch (err) {
    res.status(500).send({
      message: 'Firebase トークンを取得するときにエラーが発生しました。',
      error: err
    });
  }
});

app.listen(5000, () => console.log('Server running on localhost:5000'));

async function createCustomToken(req, uid) {
  const isApp1 = req.headers.origin === 'http://localhost:3000';
  const app = isApp1 ? app1 : app2;
  return app.auth().createCustomToken(uid);
}

function getIdToken(request) {
  if (!request.headers.authorization) {
    throw new Error('Authorization ヘッダが存在しません。')
  }
  const match = request.headers.authorization.match(/^Bearer (.*)$/)
  if (match) {
    const idToken = match[1]
    return idToken
  }
  throw new Error(
    'Authorization ヘッダから、Bearerトークンを取得できませんでした。',
  )
}