import express from 'express';
import cors from "cors";
import db from "./db/connection";

// Port
const port = 5000;

const corsOption = {
    origin: "*",
    methods: ["POST", "GET", "PUT"],
    credentials: true,
}

const app = express();
app.use(express.json());
app.use(cors(corsOption));

// Routes
import Router from './Routes/endpoints.js';
const router = Router(db);

app.use('/api', router);
app.get('/', (req, res) => {
    res.send("Howard's API");
});

app.listen(process.env.PORT || port, () => {
    console.log(`Server Running at port ${port}`);
});
