const express = require('express');
const cors = require('cors');
const morgan = require('morgan'); // Import the Morgan middleware
const db = require('./database/connection');

// Port
const port = 8080;

const corsOption = {
    origin: 'http://192.168.1.110',
    methods: ['POST', 'GET', 'PUT'],
};

const app = express();
app.use(express.json());
app.use(cors(corsOption));

// Add Morgan middleware for logging
app.use(morgan('combined')); // You can choose a different log format ('combined' is common)

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
