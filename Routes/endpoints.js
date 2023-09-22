const express = require('express');
const bcrypt = require('bcrypt');

const router = express.Router();

module.exports = (db) => {
    // Define your routes here and use the `db` connection for database operations
    const getCurrentDateTime = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0'); // Month is zero-based
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
      
        const formattedDateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        return formattedDateTime;
      };
    
    router.get('/getArtByID/:id', async (req, res) => {
        try {
            const id = req.params.id;
            const [row] = await db.query('SELECT * FROM Articulo WHERE Num_Referencia = ?', [id]);
            const UPC = row[0].Num_Referencia;
            //take the location from the other table
            const [location] = await db.query(`
            SELECT ubi.Lugar
            FROM Articulo as art
            inner JOIN Art_Ubi as AU on art.Num_Referencia = AU.Num_Referencia
            inner join Ubicacion as ubi on AU.Ubicacion = ubi.Numero
            WHERE art.Num_Referencia = ? and AU.FechaSalida IS NULL`,[UPC]);
            //get the name of the user who inserted the item
            const [user] = await db.query(`
            SELECT usr.Nombre,usr.ApePat,usr.Correo
            FROM Articulo as art
            INNER JOIN Usr_Art as ua on art.Num_Referencia = ua.Num_Referencia
            INNER JOIN Usuario as usr on ua.Usuario = usr.Numero
            WHERE art.Num_Referencia = ?`,[UPC]);
            //make the user a whole string
            const userData = user[0];
            const fullName = `${userData.Nombre} ${userData.ApePat}`;

            // Get the state of the item
            const [status] = await db.query(`
            SELECT ea.Estado,ae.Comentario
            FROM Articulo as art
            INNER JOIN Art_Est as ae ON art.Num_Referencia = ae.Num_Referencia
            INNER JOIN Estatus_Articulo as ea on ae.Estatus = ea.Numero
            WHERE art.Num_Referencia = ?`,[UPC]);
            //make the user a whole string
            const statusData = status[0];
            console.log("This is the status: "+statusData)
            const fullStatus = `${statusData.Estado}, ${statusData.Comentario}`;
//add it to the main data
            row[0].locacion = location[0].Lugar; 
            row[0].usuario = fullName;
            row[0].estado = fullStatus;

            if(row.length === 0){
                
                return res.status(404).json({
                    status: 'FAIL',
                    message: 'Articulo Inexistente',
                    data: null
                });
            }else{
                
                    return res.status(200).json({
                        status: 'SUCCESS',
                        message: 'Articulo Encontrado',
                        data: row[0],
                    });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    router.get('/idCheck/:id', async (req,res) => {
        try{
            const id = req.params.id; 
            const [row] = await db.query('select Num_Referencia from Articulo where Num_Referencia = ?',[id]);
            let check;
            if (typeof row[0].Num_Referencia === 'string'){
                return res.status(200).json({
                    id:1
                });
            }
        }catch (error) {
            console.error(error);
            res.status(200).json({ id:0 });
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
            const { email, password } = req.body;
            const [row] = await db.query('SELECT Nombre, ApePat, Correo, Passwd FROM Usuario WHERE Correo = ?', [email]);
    
            if (!row[0]) {
                return res.status(401).json({
                    status: 'FAIL',
                    message: 'Invalid email or password',
                    data: null
                });
            }
    
            const storedHashedPassword = row[0].Passwd;
    
            bcrypt.compare(password, storedHashedPassword, (err, result) => {
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
                        data: null,
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
            'INSERT INTO Usuario (Nombre, ApePat, Correo, Passwd,Rol) VALUES (?, ?, ?, ?, 2)',
            [name, lastname, email, hashedPassword]
          );
          // Return a success message
          res.status(201).json({ message: 'User registered successfully', status:'SUCCESS'});
        } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Internal Server Error' });
        }
    });

        // All brands
        router.get('/marcas', async (req, res) => {
            try {
                const [rows] = await db.query('SELECT (Nombre) FROM Marca');
                res.json(rows); 
            } catch (error) {
                console.error(error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        // All Locations
        router.get('/ubicaciones', async (req, res) => {
            try {
                const [rows] = await db.query('SELECT (Lugar) FROM Ubicacion');
                res.json(rows);
            } catch (error) {
                console.error(error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        // ADD new item
        router.post('/addItem', async (req, res) => {
            try{
                const {codigo,nombre,modelo,color,descripcion,marca,ubicacion,email} = req.body;

                const currentTimeStamp = getCurrentDateTime();
                
                const [brandResult] = await db.query(
                    'SELECT Numero FROM Marca WHERE Nombre = ?',
                    [marca]
                  );                  
                  const [locationResult] = await db.query(
                    'SELECT Numero FROM Ubicacion WHERE Lugar = ?',
                    [ubicacion]
                  );
                  const [user] = await db.query(
                    'SELECT Numero FROM Usuario WHERE Correo = ?',
                    [email]
                  );
                  console.log(user[0].Numero);

                    const brand = brandResult && brandResult[0] ? brandResult[0].Numero : null;
                    const location = locationResult && locationResult[0] ? locationResult[0].Numero : null;

                const [result] = await db.query(
                    'INSERT INTO Articulo (Num_Referencia,Nombre,Modelo,Color,Descripcion,FechaCreacion,Marca) VALUES (?,?,?,?,?,?,?)',
                    [codigo,nombre,modelo,color,descripcion,currentTimeStamp,brand]
                  );
                    //once the item is created, insert the location
                const [result2] = await db.query(
                    'INSERT INTO Art_Ubi (Ubicacion,Num_Referencia,FechaEntrada,FechaSalida,Comentario) VALUES (?,?,?,NULL,"Artiuclo nuevo, recien añadido")',
                        [location,codigo,currentTimeStamp]
                );
                const [result3] = await db.query(
                    'INSERT INTO Usr_Art (Usuario,Num_Referencia) VALUES (?,?)',
                        [user[0].Numero,codigo]
                );
                  // Return a success message
                  return res.status(200).json({
                    status: 'SUCCESS',
                    message: 'Articulo Añadido',
                    data: codigo
                });
            }catch (error){ 
                console.error("Server error:", error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        //get only the UPC //MAke them to get only the last 6 or so
        router.get('/getAllArtUPC', async (req, res) => {
            try {
              const [rows] = await db.query('SELECT Num_Referencia FROM Articulo');
              const numReferenciaArray = rows.map((row) => row.Num_Referencia);
              res.json(numReferenciaArray);
            } catch (error) {
              console.error(error);
              res.status(500).json({ error: 'Internal Server Error' });
            }
          });

          //endpoint to add a new location to the list
          router.post('/setLocation', async (req, res) => {
            try {
              const {location} = req.body;

              // Save to the DB
              const [result] = await db.query(
                "INSERT INTO Ubicacion (Lugar) VALUES (?)",
                [location]
              );
              // Return a success message
              res.status(201).json({ message: 'Ubicación Añadida' });
            } catch (error) {
              console.error(error);
              res.status(500).json({ error: 'Internal Server Error' });
            }
        });

          //endpoint to add a new Brand to the list
          router.post('/setBrand', async (req, res) => {
            try {
              const {brand} = req.body;

              // Save to the DB
              const [result] = await db.query(
                "INSERT INTO Marca (Nombre) VALUES (?)",
                [brand]
              );
              // Return a success message
              res.status(201).json({ message: 'Marca Añadida' });
            } catch (error) {
              console.error(error);
              res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        router.put('/updItem', async (req, res) => {
            try {
              const currentTimeStamp = getCurrentDateTime();
              const { UPC, ubicacion, comentario,reporte } = req.body;
          
          
              const [locationNum] = await db.query(
                'SELECT Numero FROM Ubicacion WHERE Lugar = ?',
                [ubicacion]
              );
                    
              // Check if a row with the same Num_Referencia and NULL FechaSalida exists
              const [existingRow] = await db.query(
                'SELECT * FROM Art_Ubi WHERE Num_Referencia = ? AND FechaSalida IS NULL',
                [UPC]
              );
          

              // If an existing row is found, update FechaSalida
              if (existingRow.length > 0) {
                await db.query(
                  'UPDATE Art_Ubi SET FechaSalida = ? WHERE Num_Referencia = ? AND FechaSalida IS NULL',
                  [currentTimeStamp, UPC]
                );
              } 
                // Insert a new row
                await db.query(
                  'INSERT INTO Art_Ubi (Ubicacion, Num_Referencia, FechaEntrada, Comentario) VALUES (?, ?, ?, ?)',
                  [locationNum[0].Numero, UPC, currentTimeStamp, comentario]
                );

                await db.query(
                  'UPDATE Reporte SET FechaAprobacion = ?, Estatus = ? WHERE Numero = ?',
                  [currentTimeStamp,2,reporte]
                );
          
              // Return a success message
              res.status(201).json({ message: 'Campos Actualizados', status: 'SUCCESS' });
            } catch (error) {
              console.error(error);
              res.status(500).json({ error: 'Internal Server Error' });
            }
          });

          //Reports endpoint, here is where you add a new report
          router.post('/addReport', async (req, res) => {
            try {
              const currentTimeStamp = getCurrentDateTime();
              const { UPC, ubicacion, comentario,accion,usuario} = req.body;
          
              const [user] = await db.query(
                'SELECT Numero FROM Usuario WHERE Correo = ?',
                [usuario]
              );

              const [locationNum] = await db.query(
                'SELECT Numero FROM Ubicacion WHERE Lugar = ?',
                [ubicacion]
              );

              const report = await db.query(
                `INSERT INTO Reporte (Accion,FechaCreacion,Estatus,Usuario,Articulo,Ubicacion,Comentario)
                  VALUES (?,?,1,?,?,?,?)`,[accion,currentTimeStamp,user[0].Numero,UPC,locationNum[0].Numero,comentario]
              )
          
              // Return a success message
              res.status(201).json({ message: 'Reporte Realizado', status: 'SUCCESS' });
            } catch (error) {
              console.error(error);
              res.status(500).json({ error: 'Internal Server Error' });
            }
          });

          router.get('/getReports', async (req,res) => {
            try {
              const [Reports] = await db.query(`
              SELECT Numero, Accion, FechaCreacion, Usuario, Articulo, Ubicacion, Comentario FROM Reporte WHERE Estatus = 1;
              `,[]);
              res.json(Reports);
            } catch (error) {
              console.error(error);
              res.status(500).json({ error: 'Internal Server Error' });
            }
          });

          router.get('/getReportById/:id', async (req, res) => {
            try {
              const id = req.params.id;

              const [Report] = await db.query(`
              SELECT Accion, FechaCreacion,FechaAprobacion, Estatus, Usuario, Articulo, Ubicacion, Comentario FROM Reporte WHERE Numero = ?
              `,[id]);

              const status = await db.query(`
              SELECT Estado FROM Estatus_Reporte WHERE Numero = ?
            `,[Report[0].Estatus]);

              const User = await db.query(`
              SELECT Nombre,ApePat FROM Usuario WHERE Numero = ?
            `,[Report[0].Usuario]);
            const fullName = `${User[0][0].Nombre} ${User[0][0].ApePat}`;

              const location = await db.query(`
                SELECT Lugar FROM Ubicacion WHERE Numero = ?
              `,[Report[0].Ubicacion]);

              const fullReport = {
                "Accion": Report[0].Accion,
                "FechaCreacion": Report[0].FechaCreacion,
                "FechaAprobacion": Report[0].FechaAprobacion,
                "Estatus": status[0][0].Estado,
                "Usuario": fullName,
                "Articulo": Report[0].Articulo,
                "Ubicacion": location[0][0].Lugar,
                "Comentario": Report[0].Comentario    
                        }
              res.json(fullReport);
    
            } catch (error) {
                console.error(error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        router.get(('/locationHistory/:id'), async (req,res) => {
          try{
            const id = req.params.id;

            const [history] = await db.query(`
            SELECT ubi.Lugar, au.FechaEntrada, au.FechaSalida, au.Comentario
            FROM Art_Ubi as au
		        INNER JOIN Ubicacion as ubi on au.Ubicacion = ubi.Numero
            WHERE Num_Referencia = ?
            ORDER BY FechaEntrada DESC;
            `,[id]);

            res.json(history);
          } catch (error) {
            console.error(error);
            res.status(500).json({error: 'Internal Server Error'});
          }
        })
          
    return router;
};
