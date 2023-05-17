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
const { log } = require("console");

const app = express();
const upload = multer({ dest: "uploads/" });

const s3 = new S3Client({
  region: "ap-southeast-1",
  credentials: {
    accessKeyId: "DO00F48D6G49TXRQ4JNK",
    secretAccessKey: "CiCSRYIxEv/wRzynv8NEGLElUJB0Rl0opqIXEZWp2WE",
  },
  endpoint: "https://sgp1.digitaloceanspaces.com",
});

const bucketName = "cocreate";

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

app.get("/api/storage/:path", async (req, res) => {
  const { path } = req.params;
  const { key } = req.query;

  const getParams = {
    Bucket: bucketName,
    Key: `${path}/${key}`,
  };

  try {
    // Use stream
    const data = await s3.send(new GetObjectCommand(getParams));
    const fileStream = data.Body;

    res.setHeader("Content-Disposition", `attachment; filename=${key}`);
    res.setHeader("Content-Type", data.ContentType);
    res.setHeader("Content-Length", data.ContentLength);

    fileStream.pipe(res.status(200));
  } catch (error) {
    res.status(500).json({ error: "Error downloading the file" });
  }
});

app.put("/api/storage/:path", upload.single("file"), async (req, res) => {
  const { path } = req.params;
  const { key } = req.body;
  const { file } = req;

  const fileStream = fs.createReadStream(file.path);

  const putParams = {
    Bucket: bucketName,
    Key: `${path}/${key}`,
    Body: fileStream,
    ACL: "public-read", // Set ACL to public-read
  };

  try {
    await s3.send(new PutObjectCommand(putParams));

    res.status(200).json({ message: "File uploaded successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error uploading the file" });
  }
});

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

app.listen(3000, () => console.log("App listening on port 3000"));
