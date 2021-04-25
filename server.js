// load envs
require("dotenv").config({
  path:
    process.env.NODE_ENV === "development"
      ? ".env.development"
      : ".env.production",
});
// allows cross origin requests
const cors = require("cors");
// custom server
const express = require("express");
// file services
const fs = require("fs-extra");
// logging framework
const morgan = require("morgan");
// converts "multipart/formdata" requests to buffer as "req.file"
const multer = require("multer");
// creates a unique string
const uuid = require("uuid").v4;

// this 'CLIENT' variable should be set by an .env (.env.development and .env.production)
const { CLIENT, APIPORT } = process.env;
const app = express();

// middleware console logging framework (ex: GET /image/1234.png 200)
app.use(morgan("tiny"));

// middleware function that only allows 'GET' requests, but from anywhere
// you can limit this to certain domains by using the "origin" property
app.use("/uploads", cors({ methods: ["GET"] }));

// middleware function that only allows save requests to originate from the client domain
app.use("/upload-file", cors({ origin: CLIENT }));

// middleware function that parses a single image file FormData to "req.file",
// and checks if the image is "image/png" or "image/pdf";
app.use(
  multer({
    limits: {
      fileSize: 10240000,
      files: 1,
      fields: 1,
    },
    fileFilter: (req, file, next) => {
      if (
        !/png|pdf/.test(file.mimetype) &&
        !/png|pdf/.test(file.originalname)
      ) {
        req.err = "That file extension is not accepted!";
        next(null, false);
      }
      next(null, true);
    },
  }).single("file")
);

// when a request hits "http://localhost:4000/upload-file", it passes through this function
app.post("/upload-file", async (req, res) => {
  try {
    // checks if the file passes the multer middleware
    // 1.) Is the file a png/pdf?
    // 2.) Is the file present?
    if (req.err || !req.file)
      throw String(req.err || "Unable to process the uploaded file.");

    const fileext = req.file.originalname.split(".")[1];

    // name of the image
    const name = `${uuid()}.${fileext}`;
    // filepath to save the image to local disk storage: "projectroot/images/1234.png"
    const filepath = `uploads/${name}`;

    // create "images" folder if not present
    await fs.ensureDir("uploads");

    // save image to "images" folder (ex: images/1234.png)
    await fs.writeFile(filepath, req.file.buffer);

    // return image file path to client
    return res.status(200).json({ filepath });
  } catch (err) {
    // return any errors to client as "response.data.err"
    return res.status(400).json({ err: err.toString() });
  }
});

// serves uploads from "uploads" directory
app.use("/uploads", express.static("uploads"));

// listens to request to "http://localhost:4000"
app.listen(APIPORT, (err) => {
  try {
    if (err) throw err;

    console.log(`Listening for requests from: \x1b[1m${CLIENT}\x1b[0m\n`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
});
