const express = require('express');
const bcrypt = require('bcrypt');
const upload = require('./../multerConfig');

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
            const [row] = await db.query(`
            SELECT
              art.Num_Referencia,art.NSerial,art.Nombre,art.Modelo,art.Descripcion,art.FechaCreacion,
              art.Marca,art.Resguardante,ubi.Lugar as locacion,mun.Nombre as Municipio,
              concat(usr.Nombre,' ',usr.ApePat) as usuario,concat(est_art.Estado,', ',ae.Comentario) as estado
              FROM Articulo as art
              INNER JOIN Art_Ubi as AU on art.Num_Referencia = AU.Num_Referencia
              INNER JOIN Ubicacion as ubi on AU.Ubicacion = ubi.Numero
              INNER JOIN Municipio as mun on AU.Municipio = mun.Numero
              INNER JOIN Usr_Art as ua on art.Num_Referencia = ua.Num_Referencia
              INNER JOIN Usuario as usr on ua.Usuario = usr.Numero
              INNER JOIN Art_Est as ae ON art.Num_Referencia = ae.Num_Referencia
              INNER JOIN Estatus_Articulo as ea on ae.Estatus = ea.Numero
                          INNER JOIN Estatus_Articulo as est_art on ae.Estatus = est_art.Numero
                          WHERE art.Num_Referencia = ?
                  AND ae.Fecha = (
                      SELECT MAX(Fecha)
                      FROM Art_Est
                      WHERE Num_Referencia = ?
                  )and AU.FechaSalida IS NULL LIMIT 1;
            `, [id,id]);
            console.log("this is the sht: ",row[0]);
            //Get the name of the Images
            const [images] = await db.query(
              'SELECT NombreImagen FROM Imagenes WHERE Num_Referencia = ?',[id]
            );
            const imageNames = images.map((obj) => obj.NombreImagen);
          
            // Check if there are images associated with the reference
            if (imageNames.length > 0) {
              // Set the 'images' property if there are images
              row[0].images = imageNames;
            } else {
              // Handle the case where there are no images
              row[0].images = [];
            }

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

    //check if the UPC exists or not
    router.get('/idCheck/:id', async (req,res) => {
        try{
            const id = req.params.id; 
            const [row] = await db.query('select Num_Referencia from Articulo where Num_Referencia = ?',[id]);
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

    //Check if the serial number exists or not
    router.get('/serialCheck/:id', async (req,res) => {
      try{
          const id = req.params.id; 
          const [row] = await db.query('select NSerial from Articulo where NSerial= ?',[id]);
          if (typeof row[0].NSerial === 'string'){
              return res.status(200).json({
                  id:1
              });
          }
      }catch (error) {
          console.error(error);
          res.status(200).json({ id:0 });
      }
  });

    router.get('/getUsers', async (req,res) => {
      try {
        const [row] = await db.query(`
        SELECT U.Nombre, U.ApePat, U.Correo, R.Rol
        FROM Usuario AS U
        INNER JOIN Rol AS R ON U.Rol = R.Numero`,[]);

        res.json(row);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
    });

    router.post('/setUser/:id', async (req,res) => {
      try{
          const email = req.params.id;
          const {Rol} = req.body;
          const [rolNum] = await db.query(
            `SELECT Numero FROM Rol WHERE Rol = ?`,[Rol]
          );
          const changeRol = await db.query(
            `UPDATE Usuario SET Rol = ? WHERE Correo = ?`,[rolNum[0].Numero,email]
          );
           // Return a success message
           return res.status(200).json({
            status: 'SUCCESS',
            message: 'Rol Actualizado',
           })
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    //get the pwd, then decrypt it and send it to the client like that
    router.post('/login', async (req, res) => {
        try {
            const { email, password } = req.body;
            const [row] = await db.query(`
            SELECT U.Nombre, U.ApePat, U.Correo, U.Passwd,R.Numero
            FROM Usuario as U
            INNER JOIN Rol AS R ON U.Rol = R.Numero
            WHERE Correo = ?
            `, [email]);
    
            if (!row[0]) {
                return res.status(201).json({
                    status: 'FAIL',
                    message: 'Correo o Contraseña Erroneas',
                    data: null
                });
            }
    
            const storedHashedPassword = row[0].Passwd;
    
            bcrypt.compare(password, storedHashedPassword, (err, result) => {
                if (result === true) {
                    const userData = {
                        name: row[0].Nombre,
                        lastName: row[0].ApePat,
                        email: row[0].Correo,
                        role: row[0].Numero
                    };
    
                    return res.status(200).json({
                        status: 'SUCCESS',
                        message: 'Login successful',
                        data: userData
                    });
                } else {
                    return res.status(201).json({
                        status: 'FAIL',
                        message: 'Correo o Contraseña Erroneas',
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
        router.post('/addItem', upload.array('images', 5), async (req, res) => {
            try{
              const {codigo,serial,nombre,modelo
                ,descripcion,marca,ubicacion,municipio,email,resguardante} = req.body;
                // Access uploaded images using req.files
                const images = req.files;

                // Save the image file names and paths to an array
                const imagePaths = images.map((image) => ({
                  path: image.path, // Path where the image is saved on the server
                  fileName: image.filename, // Filename assigned by multer
                }));

                const currentTimeStamp = getCurrentDateTime();
                
                const [brandResult] = await db.query(
                    'SELECT Numero FROM Marca WHERE Nombre = ?',
                    [marca]
                  );                  
                  const [locationResult] = await db.query(
                    'SELECT Numero FROM Ubicacion WHERE Lugar = ?',
                    [ubicacion]
                  );
                  const [municipioResult] = await db.query(
                    'SELECT Numero FROM Municipio WHERE Nombre = ?',
                    [municipio]
                  );
                  const [user] = await db.query(
                    'SELECT Numero FROM Usuario WHERE Correo = ?',
                    [email]
                  );
                  console.log(user[0].Numero);

                    const brand = brandResult && brandResult[0] ? brandResult[0].Numero : null;
                    const location = locationResult && locationResult[0] ? locationResult[0].Numero : null;

                const [result] = await db.query(
                    'INSERT INTO Articulo (Num_Referencia,NSerial,Nombre,Modelo,Descripcion,FechaCreacion,Marca,resguardante) VALUES (?,?,?,?,?,?,?,?)',
                    [codigo,serial,nombre,modelo,descripcion,currentTimeStamp,brand,resguardante]
                  );
                    //once the item is created, insert the location
                const [result2] = await db.query(
                    'INSERT INTO Art_Ubi (Ubicacion,Num_Referencia,FechaEntrada,FechaSalida,Comentario,Municipio) VALUES (?,?,?,NULL,"Artiuclo nuevo, recien añadido",?)',
                        [location,codigo,currentTimeStamp,municipioResult[0].Numero]
                );
                const [result3] = await db.query(
                    'INSERT INTO Usr_Art (Usuario,Num_Referencia) VALUES (?,?)',
                        [user[0].Numero,codigo]
                );

                     // Loop through the images array and insert filenames into the table
                     for (const image of images) {
                      await db.query(
                        'INSERT INTO Imagenes (Num_Referencia, NombreImagen) VALUES (?, ?)',
                        [codigo, image.filename]
                      );
                    }
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
              const { UPC, ubicacion, comentario,reporte, municipio } = req.body;
          
          
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
              //get the number of the Municipio
              const [municipioNum] = await db.query(
                'select numero from Municipio where Nombre = ?',
                [municipio]
              );
              console.log("A ver ",municipio," ",municipioNum);

                // Insert a new row
                await db.query(
                  'INSERT INTO Art_Ubi (Ubicacion, Num_Referencia, FechaEntrada, Comentario, Municipio) VALUES (?, ?, ?, ?, ?)',
                  [locationNum[0].Numero, UPC, currentTimeStamp, comentario,municipioNum[0].numero]
                );
                if(reporte){// if reporte is not defined is because an admin is tryong to disable an item, so no report required
                await db.query(
                  'UPDATE Reporte SET FechaAprobacion = ?, Estatus = ? WHERE Numero = ?',
                  [currentTimeStamp,2,reporte]
                );
                }
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
              const { UPC, ubicacion, comentario,accion,usuario,municipio} = req.body;
          
              const [user] = await db.query(
                'SELECT Numero FROM Usuario WHERE Correo = ?',
                [usuario]
              );

              const [locationNum] = await db.query(
                'SELECT Numero FROM Ubicacion WHERE Lugar = ?',
                [ubicacion]
              );

              const [municipioNum] = await db.query(
                'SELECT Numero FROM Municipio WHERE Nombre = ?',
                [municipio]
              );

              const report = await db.query(
                `INSERT INTO Reporte (Accion,FechaCreacion,Estatus,Usuario,Articulo,Ubicacion,Municipio,Comentario)
                  VALUES (?,?,1,?,?,?,?,?)`,[accion,currentTimeStamp,user[0].Numero,UPC,locationNum[0].Numero,municipioNum[0].Numero,comentario]
              )
          
              // Return a success message
              res.status(201).json({ message: 'Reporte Realizado', status: 'SUCCESS' });
            } catch (error) {
              console.error(error);
              res.status(500).json({ error: 'Internal Server Error' });
            }
          });

          //Get all reports pending
          router.get('/getReports', async (req,res) => {
            try {
              const [Reports] = await db.query(`
              SELECT Numero, Accion, FechaCreacion, Usuario, Articulo, Ubicacion,Municipio, Comentario FROM Reporte WHERE Estatus = 1;
              `,[]);
              res.json(Reports);
            } catch (error) {
              console.error(error);
              res.status(500).json({ error: 'Internal Server Error' });
            }
          });

          //Get all reports solved
          router.get('/getReportsHistory', async (req,res) => {
            try {
              const [Reports] = await db.query(`
              SELECT Numero, Accion, FechaCreacion, Usuario, Articulo, Ubicacion,Municipio, Comentario FROM Reporte WHERE Estatus = 2;
              `,[]);
              res.json(Reports);
            } catch (error) {
              console.error(error);
              res.status(500).json({ error: 'Internal Server Error' });
            }
          });

           //Get all bajas issued
           router.get('/getBajasHistory', async (req,res) => {
            try {
              const [Reports] = await db.query(`
              select Num_Referencia from Art_Est where Estatus = 3;
              `,[]);
              res.json(Reports);
            } catch (error) {
              console.error(error);
              res.status(500).json({ error: 'Internal Server Error' });
            }
          });

          //get a report with its ID -Merged the Queries
          router.get('/getReportById/:id', async (req, res) => {
            try {
              const id = req.params.id;

              const [Report] = await db.query(`
              SELECT rep.Accion , rep.FechaCreacion,rep.FechaAprobacion, er.Estado as EstatusRep,concat(usr.Nombre,' ',usr.ApePat) as Usuario, art.Num_Referencia as UPC,art.NSerial as Serial,art.Nombre as Articulo,mar.Nombre as Marca,art.Modelo as Modelo,art.Resguardante,ubi.Lugar as Ubicacion,mun.Nombre as Municipio,rep.Comentario as Motivo
              from Articulo as art
              inner join Reporte as rep on art.Num_Referencia = rep.Articulo
              inner join Estatus_Reporte as er on rep.Estatus = er.Numero
              inner join Usuario as usr on rep.Usuario = usr.Numero
              inner join Ubicacion as ubi on rep.Ubicacion = ubi.Numero
              inner join Municipio as mun on rep.Municipio = mun.Numero
              inner join Marca as mar on art.Marca = mar.Numero
              where rep.Numero = ?
              `,[id]);

              res.json(Report);
    
            } catch (error) {
                console.error(error);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        //history of the location of a particular item
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
        });

        //Router to get the awaitng comfirm pending "bajas" from the items
        router.get('/getPendingStatus', async (req,res) => {
          try{

            const [bajas] = await db.query(`
            SELECT *
            FROM Art_Est
            WHERE Estatus = 3
              AND Num_Referencia NOT IN (
                SELECT Num_Referencia
                FROM Art_Est
                WHERE Estatus = 2
              );
            
            `,[]);

            res.json(bajas);
          } catch (error) {
            console.error(error);
            res.status(500).json({error: 'Internal Server Error'});
          }
        });

        router.get('/getMotiveDisable/:upc', async (req,res) => {
          try{
            const UPC = req.params.upc;
            const [motivo] = await db.query(`
            SELECT comentario
            FROM Art_Est
            WHERE Num_Referencia = ?
            ORDER BY Fecha DESC
            LIMIT 1;
            `,[UPC]);

            res.json(motivo[0]);
          } catch (error) {
            console.error(error);
            res.status(500).json({error: 'Internal Server Error'});
          }
        })
        //turn the "estado" of the item into a "baja" or a "baja pendiente"
        router.post('/disableItem/:op', async (req,res) => {
          try {
            const currentTimeStamp = getCurrentDateTime();
            const op = req.params.op;
            console.log("this is the OP: ",op)
            if(parseInt(op) === 1){//check if you making a report or your disabling for good an item
              console.log("Here at the 1");
            const {UPC,comentario,reporte} = req.body;
        //add the new status to the item
            await db.query(
              'INSERT INTO Art_Est (Estatus, Num_Referencia, Comentario, Fecha) VALUES (3,?,?,?)',
              [UPC,comentario,currentTimeStamp]
            );
              //change the status of the report so it can now be checked
              if(reporte){// if reporte is not defined is because an admin is tryong to disable an item, so no report required
              await db.query(
                'UPDATE Reporte SET FechaAprobacion = ?, Estatus = ? WHERE Numero = ?',
                [currentTimeStamp,2,reporte]
              );
              }
            } else if (parseInt(op) === 2){
              console.log("Here at the 2nd");
              const {UPC,comentario,comfirmedDate} = req.body;
              const formattedTimestamp = new Date(comfirmedDate).toISOString().slice(0, 19).replace('T', ' ');
              await db.query(
                'INSERT INTO Art_Est (Estatus, Num_Referencia, Comentario, Fecha,FechaConfirmacion) VALUES (2,?,?,?,?)',
                [UPC,comentario,currentTimeStamp,formattedTimestamp]
              );
            }
        
            // Return a success message
            res.status(201).json({ message: 'Baja Realizada', status: 'SUCCESS' });
          } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
          }
        });

        //comfirm that that the item has a "baja" pendding, so they can add a date if comfirmation from Mexicali
        router.get('/getBajasPendientes/:id', async (req,res) => {
          try {
            const id = req.params.id;
            const [row] = await db.query(`SELECT *
            FROM Articulo
            WHERE Num_Referencia = ?
            AND ? IN (
                SELECT Num_Referencia
                FROM Art_Est
                WHERE Estatus = 3
            )
            AND ? NOT IN (
                SELECT Num_Referencia
                FROM Art_Est
                WHERE Estatus = 2
            );`, [id,id,id]);

            if(row.length === 0){
              return res.status(404).json({
                status: 'FAIL',
                message: 'Este artículo no tiene una baja pendiente',
                data: null
            });
        }else{  
                    return res.status(200).json({
                        status: 'SUCCESS',
                        message: 'Articulo Encontrado',
                        data: row[0].Num_Referencia,
                    });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
        });

        //makes the pdf depending on the option number thats being sent within the url
        router.get('/pdfMaker/:op', async (req,res) => {
          try {
          const op = req.params.op;

          // Create an object to store items organized by location
          const objItemsOrg = {};
      
          // Get the "active" items (not baja)
          if (parseInt(op) === 1) {
            const [locations] = await db.query('select * from Ubicacion', []);
      
            for (const location of locations) {
              const locationName = location.Lugar;
      
              const [items] = await db.query(`
                SELECT DISTINCT art.Num_Referencia as UPC, art.NSerial as Serial, art.Nombre as Nombre, mar.Nombre as Marca, art.Modelo as Modelo, 
                art.Descripcion as Descripcion, mun.Nombre as Municipio, art.Resguardante as Resguardante
                FROM Articulo AS art
                INNER JOIN Art_Est AS ae ON art.Num_Referencia = ae.Num_Referencia
                INNER JOIN Estatus_Articulo AS ea ON ae.Estatus = ea.Numero
                INNER JOIN Art_Ubi AS au ON art.Num_Referencia = au.Num_Referencia
                INNER JOIN Ubicacion AS ubi ON au.Ubicacion = ubi.Numero
                INNER JOIN Marca AS mar ON art.Marca = mar.Numero
                INNER JOIN Municipio AS mun ON au.Municipio = mun.Numero
                WHERE ubi.Lugar = ?
                AND art.Num_Referencia NOT IN (
                    SELECT Num_Referencia FROM Art_Est WHERE Estatus = 2 OR Estatus = 3
                );
              `, [locationName]);
      
              // Store the items in the object organized by location
              objItemsOrg[locationName] = items;
            }

          } else {
            const [locations] = await db.query('select * from Ubicacion', []);
      
            for (const location of locations) {
              const locationName = location.Lugar;
      
              const [items] = await db.query(`
                SELECT DISTINCT art.Num_Referencia as UPC, art.NSerial as Serial, art.Nombre as Nombre, mar.Nombre as Marca, art.Modelo as Modelo, 
                art.Descripcion as Descripcion, mun.Nombre as Municipio, art.Resguardante as Resguardante, ae.FechaConfirmacion as Confirmacion
                FROM Articulo AS art
                INNER JOIN Art_Est AS ae ON art.Num_Referencia = ae.Num_Referencia
                INNER JOIN Estatus_Articulo AS ea ON ae.Estatus = ea.Numero
                INNER JOIN Art_Ubi AS au ON art.Num_Referencia = au.Num_Referencia
                INNER JOIN Ubicacion AS ubi ON au.Ubicacion = ubi.Numero
                INNER JOIN Marca AS mar ON art.Marca = mar.Numero
                INNER JOIN Municipio AS mun ON au.Municipio = mun.Numero
                WHERE ubi.Lugar = ?
                AND art.Num_Referencia IN (
                    SELECT Num_Referencia FROM Art_Est WHERE Estatus = 2 OR Estatus = 3
                );
              `, [locationName]);
      
              // Store the items in the object organized by location
              objItemsOrg[locationName] = items;
            }

          }
          res.json(objItemsOrg);
        }catch (error) {
          console.error(error);
        }
        });

        router.get('/countItems', async (req,res) => {
          try{
          const [count] = await db.query(`
          SELECT (SELECT count(Num_Referencia) FROM Art_Est WHERE Estatus = 1 AND Num_Referencia NOT IN 
          (SELECT Num_Referencia FROM Art_Est WHERE Estatus IN (2, 3))) AS Activos, 
          (SELECT count(Num_Referencia) FROM Art_Est WHERE Estatus = 3 AND Num_Referencia NOT IN 
          (SELECT Num_Referencia FROM Art_Est WHERE Estatus = 2)) AS Pendientes, 
          (SELECT count(Num_Referencia) FROM Art_Est WHERE Estatus = 2) AS Baja;
          `,[]);
          res.json(count[0]);
          }catch (error){
            console.error(error);
          }
        } );
          
    return router;
};
