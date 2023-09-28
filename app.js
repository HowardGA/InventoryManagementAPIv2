const express = require('express');
const cors = require('cors');
const db = require('./database/connection');

// Port
const port = 8080;

const corsOption = {
    origin: '*',
    methods: ['POST', 'GET', 'PUT'],
    credentials: true,
};

const app = express();
app.use(express.json());
app.use(cors(corsOption));

// Serve static files from the "images" folder
app.use('/images', express.static(__dirname + '/images'));
// Routes
const Router = require('./Routes/endpoints');
const router = Router(db);

app.use('/api', router);
app.get('/', (req, res) => {
    res.send("Howard's API");
});

app.listen(process.env.PORT || port, () => {
    console.log(`Server Running at port ${port}`);
});
