const express = require("express");
const multer = require("multer");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsCommand,
} = require("@aws-sdk/client-s3");
const fs = require("fs");
const dotenv = require("dotenv");

const app = express();
const upload = multer({ dest: "uploads/" });
const mime = require("mime-types");

if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

const port = process.env.PORT || 3000;

console.log("Starting server");

const s3 = new S3Client({
  region: "ap-southeast-1",
  credentials: {
    accessKeyId: "DO00F48D6G49TXRQ4JNK",
    secretAccessKey: "CiCSRYIxEv/wRzynv8NEGLElUJB0Rl0opqIXEZWp2WE",
  },
  endpoint: "https://sgp1.digitaloceanspaces.com",
});

const bucketName = "cocreate";

console.log("Initializing bucket", bucketName);

console.log("Initializing routes: [GET] /api/storage/:path/list");

app.get("/", (req, res) => {
  res.send("Server Active");
});

// List all files in a directory
app.get("/api/storage/:path/list", async (req, res) => {
  const { path } = req.params;
  console.log("Listing files", path);

  const listParams = {
    Bucket: bucketName,
    Prefix: path,
  };

  try {
    const data = await s3.send(new ListObjectsCommand(listParams));
    const files = data.Contents.map((file) => {
      const path = file.Key.split("/");
      return path[path.length - 1];
    });

    console.log("Listing files", path, "succeeded");
    res.status(200).json({ files });
  } catch (error) {
    console.error("Listing files", path, "failed with error", error);
    res.status(500).json({ error: "Error listing the files" });
  }
});

console.log("Initializing routes : [GET] /api/storage/:path?key=key");

app.get("/api/storage/:path", async (req, res) => {
  const { path } = req.params;
  const { key } = req.query;

  const getParams = {
    Bucket: bucketName,
    Key: `${path}/${key}`,
  };

  try {
    const data = await s3.send(new GetObjectCommand(getParams));

    const fileStream = data.Body;
    const contentType = mime.lookup(key); // Get the content type based on the file extension

    res.setHeader("Content-Disposition", `attachment; filename=${key}`);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", data.ContentLength);

    fileStream.pipe(res.status(200));
  } catch (error) {
    res.status(500).json({ error: "Error downloading the file" });
  }
});

console.log("Initializing routes: [PUT] /api/storage/:path");

app.post("/api/storage/:path", upload.single("file"), async (req, res) => {
  const { path } = req.params;
  const { key } = req.body;
  const { file } = req;

  const fileStream = fs.createReadStream(file.path);

  const contentType = mime.lookup(file.originalname); // Get the content type based on the file extension

  const putParams = {
    Bucket: bucketName,
    Key: `${path}/${key}`,
    Body: fileStream,
    ACL: "public-read", // Set ACL to public-read
    ContentType: contentType, // Set the content type
  };

  try {
    await s3.send(new PutObjectCommand(putParams));

    res.status(200).json({ message: "File uploaded successfully" });

    fs.unlink(file.path, (err) => {
      if (err) {
        console.error("Error removing file", err);
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Error uploading the file" });
  }
});

console.log("Initializing routes: [DELETE] /api/storage/:path?key=key");

app.delete("/api/storage/:path", async (req, res) => {
  const { path } = req.params;
  const { key } = req.query;

  const deleteParams = {
    Bucket: bucketName,
    Key: `${path}/${key}`,
  };

  try {
    await s3.send(new DeleteObjectCommand(deleteParams));

    res.status(200).json({ message: "File deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting the file" });
  }
});

app.listen(port, () =>
  console.log(`API available on http://localhost:${port}`)
);
