const multer = require('multer');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'Images'); // Specify the destination folder
  },
  filename: function (req, file, cb) {
    // Use the original filename
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

module.exports = upload;
