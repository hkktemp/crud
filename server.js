const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const bodyParser = require('body-parser');
const fs = require('fs');
const config = require('./config');
const app = express();

// Enable CORS
app.use(cors());

// Middleware to parse JSON and URL-encoded data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Set up storage for uploaded images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'Database/Images');
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const numberPlate = req.body.numberPlate;
    if (numberPlate) {
      cb(null, `${numberPlate}${path.extname(file.originalname)}`);
    } else {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  },
});

const upload = multer({ storage });

// Serve static images
app.use('/images', express.static(path.join(__dirname, 'Database/Images')));

// Endpoint to upload images
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const imageUrl = `/images/${req.file.filename}`;
  res.status(200).json({ message: 'Image uploaded successfully', imageUrl });
});

// API Endpoint to save vehicle data
app.post('/api/vehicles', (req, res) => {
  const newVehicle = req.body;
  const filePath = path.join(__dirname, 'Database/Vehicles.json');

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([]), 'utf8');
  }

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read vehicle data' });
    }

    let vehicles;
    try {
      vehicles = JSON.parse(data);
    } catch {
      return res.status(500).json({ error: 'Invalid JSON in Vehicles.json' });
    }

    vehicles.push(newVehicle);

    fs.writeFile(filePath, JSON.stringify(vehicles, null, 2), (err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to save vehicle data' });
      }

      res.status(201).json({ message: 'Vehicle added successfully', newVehicle });
    });
  });
});

// Endpoint to get vehicle data
app.get('/api/vehicles', (req, res) => {
  const filePath = path.join(__dirname, 'Database/Vehicles.json');

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Vehicle data not found' });
  }

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read vehicle data' });
    }

    try {
      const vehicles = JSON.parse(data);
      res.status(200).json(vehicles);
    } catch {
      return res.status(500).json({ error: 'Invalid JSON in vehicle data' });
    }
  });
});

// Endpoint to update the vehicle with matching numberPlate or add new vehicle if numberPlate is new
app.patch('/api/vehicles', (req, res) => {
  const updatedVehicleData = req.body.newCar;
  const filePath = path.join(__dirname, 'Database/Vehicles.json');

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Vehicle data not found' });
  }

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read vehicle data' });
    }

    let vehicles;
    try {
      vehicles = JSON.parse(data);
    } catch {
      return res.status(500).json({ error: 'Invalid JSON in Vehicles.json' });
    }

    // If the vehicles array is empty, return an error
    if (vehicles.length === 0) {
      return res.status(404).json({ error: 'No vehicles to update' });
    }

    // Find the existing vehicle by numberPlate
    const existingVehicleIndex = vehicles.findIndex(
      (vehicle) => vehicle.numberPlate === updatedVehicleData.numberPlate
    );

    // If the vehicle with the same numberPlate exists, update it
    if (existingVehicleIndex !== -1) {
      // Preserve the original phoneNumber if it is not provided in the request
      const existingVehicle = vehicles[existingVehicleIndex];
      const phoneNumber = updatedVehicleData.phoneNumber || existingVehicle.phoneNumber;

      vehicles[existingVehicleIndex] = { 
        phoneNumber,  // Ensure phone number comes first
        ...updatedVehicleData,
      };

      // Save the updated vehicles list back to the file
      fs.writeFile(filePath, JSON.stringify(vehicles, null, 2), (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to update vehicle data' });
        }

        return res.status(200).json({ message: 'Vehicle updated successfully', updatedVehicle: vehicles[existingVehicleIndex] });
      });
    } else {
      // If no vehicle with the same numberPlate, add new entry with the same phone number as the last entry
      const lastVehicle = vehicles[vehicles.length - 1];
      const newVehicle = {
        phoneNumber: updatedVehicleData.phoneNumber || (lastVehicle ? lastVehicle.phoneNumber : null), // Ensure phone number comes first
        ...updatedVehicleData,
      };

      vehicles.push(newVehicle);

      fs.writeFile(filePath, JSON.stringify(vehicles, null, 2), (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to add new vehicle data' });
        }

        res.status(201).json({ message: 'Vehicle added successfully', newVehicle });
      });
    }
  });
});

// Firebase configuration endpoint
app.get('/config', (req, res) => {
  res.status(200).json(config);
});

// Start server
app.listen(config.PORT, config.IP, () => {
  console.log(`Server is running on http://${config.IP}:${config.PORT}`);
});
