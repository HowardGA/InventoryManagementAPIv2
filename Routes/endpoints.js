import express from 'express';
import bcrypt from 'bcrypt';

const router = express.Router();

export default (db) => {
    // Define your routes here and use the `db` connection for database operations
    
    router.get('/getArtByID/:id', async (req, res) => {
        try {
            const id = req.params.id;
            const [row] = await db.query('SELECT * FROM Articulo WHERE Num_Referencia = ?', [id]);
            res.json(row[0]);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    router.get('/getAllArt', async (req, res) => {
        try {
            const [row] = await db.query('SELECT * FROM Articulo');
            res.json(row[0]);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    //get the pwd, then decrypt it and send it to the client like that
    router.post('/login', async (req, res) => {
        try {
            const { email, pwd } = req.body;
            const [row] = await db.query('SELECT Nombre, ApePat, Correo, Passwd FROM Usuario WHERE Correo = ?', [email]);
    
            if (!row[0]) {
                return res.status(401).json({
                    status: 'FAIL',
                    message: 'Invalid email or password',
                    data: null
                });
            }
    
            const storedHashedPassword = row[0].Passwd;
    
            bcrypt.compare(pwd, storedHashedPassword, (err, result) => {
                if (result === true) {
                    const userData = {
                        name: row[0].Nombre,
                        lastName: row[0].ApePat,
                        email: row[0].Correo
                    };
    
                    return res.status(200).json({
                        status: 'SUCCESS',
                        message: 'Login successful',
                        data: userData
                    });
                } else {
                    return res.status(401).json({
                        status: 'FAIL',
                        message: 'Invalid email or password',
                        data: null
                    });
                }
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                status: 'FAIL',
                message: 'Internal Server Error',
                data: null
            });
        }
    });
    
    // /register route
    router.post('/register', async (req, res) => {
        try {
          const { name, lastname, email, password } = req.body;
          // Hash the password
          const hashedPassword = await bcrypt.hash(password, 10);
          // Save to the DB
          const [result] = await db.query(
            'INSERT INTO Usuario (Nombre, ApePat, Correo, Passwd) VALUES (?, ?, ?, ?)',
            [name, lastname, email, hashedPassword]
          );
          // Return a success message
          res.status(201).json({ message: 'User registered successfully' });
        } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    return router;
};
