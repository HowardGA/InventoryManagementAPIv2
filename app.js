import express from 'express';
import cors from "cors";
import db from "./db/connection";
//port
const port = 5000

const corsOption = {
    origin: "*",
    methods: ["POST","GET","PUT"],
    credentials: true,
}

const app = express();
app.use(express.json());
app.use(cors(corsOption));

// Routes
const Router = require('./Routes/endpoints.js')(db);

app.use('/api', Router);
app.get('/', (req, res) => {
    res.send("Howard's API");
});

app.listen(process.env.PORT || port, () => {
    console.log(`Server Running at port ${port}`);
});