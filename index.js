const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();

// Default Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: ["http://localhost:5173", "https://quickreads-library.netlify.app"], // Client Side Server
    credentials: true,
  })
);

// Manual Middlewares
const verifyToken = async (req, res, next) => {
  try {
    const token = req.cookies?.token;
    if (token) {
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if (error) {
          return res
            .status(401)
            .send({ status: 401, message: "Unauthorized Access" });
        } else {
          req.user = decoded;
          next();
        }
      });
    } else {
      return res
        .status(401)
        .send({ status: 401, message: "Unauthorized Access" });
    }
  } catch (error) {
    res.status(401).send("Unauthorized");
  }
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_USER_PASSWORD}@cluster0.wixlrgj.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();

    const categoryCollection = client
      .db("quickReadsDB")
      .collection("categories");
    const usersCollection = client.db("quickReadsDB").collection("users");
    const booksCollection = client.db("quickReadsDB").collection("books");
    const borrowedBooksCollection = client
      .db("quickReadsDB")
      .collection("borrowedBooks");

    // JWT Related API

    app.post("/api/auth/access-token", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
        .send({ success: true });
    });

    app.post("/api/auth/logout", async (req, res) => {
      const user = req.body;
      console.log("user in the token", user);
      res
        .clearCookie("token", { maxAge: 0, sameSite: "none", secure: true })
        .send({ success: true });
    });

    // Category Related API

    app.get("/api/categories", async (req, res) => {
      const result = await categoryCollection.find().toArray();
      res.send(result);
    });

    app.get("/api/categories/:category", async (req, res) => {
      const category = req.params.category;
      const query = {
        category: category,
      };
      const result = await categoryCollection.findOne(query);
      res.send(result);
    });

    app.post("/api/categories", async (req, res) => {
      const newCategory = req.body;
      const result = await categoryCollection.insertOne(newCategory);
      res.send(result);
    });

    // User Related API
    app.get("/api/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post("/api/users", async (req, res) => {
      const newUser = req.body;
      const result = await usersCollection.insertOne(newUser);
      res.send(result);
    });

    // Books Related API

    app.get("/api/books", verifyToken, async (req, res) => {
      const queries = {};
      if (req.query.quantity !== "null") {
        queries.quantity = { $gt: parseInt(req.query.quantity) };
      }

      const result = await booksCollection.find(queries).toArray();
      res.send(result);
    });

    app.get("/api/books/:category", async (req, res) => {
      const queryCategory = req.params?.category;
      const query = {
        bookCategory: queryCategory,
      };
      const result = await booksCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/api/books/bookName/:name", async (req, res) => {
      const queryName = req.params?.name;
      const query = {
        name: queryName,
      };
      const result = await booksCollection.findOne(query);
      res.send(result);
    });

    // app.get("/api/books/query/quantity", async (req, res) => {
    //   const query = {};
    //   const result = await booksCollection.find().toArray();
    //   res.send(result);
    // });

    app.get("/api/books/singleBook/:id([0-9a-fA-F]{24})", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await booksCollection.findOne(query);
      res.send(result);
    });

    app.post("/api/books", verifyToken, async (req, res) => {
      const newBooks = req.body;
      const result = await booksCollection.insertOne(newBooks);
      res.send(result);
    });

    app.put("/api/books/singleBook/:id([0-9a-fA-F]{24})", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedBook = req.body;
      const options = { upsert: true };
      const newBook = {
        $set: {
          ...updatedBook,
        },
      };
      const result = await booksCollection.updateOne(filter, newBook, options);
      res.send(result);
    });

    app.patch("/api/books/singleBook/:bookName", async (req, res) => {
      const bookName = req.params.bookName;
      const filter = { name: bookName };
      const setQuantity = {
        $set: req.body,
      };
      const result = await booksCollection.updateOne(filter, setQuantity);
      res.send(result);
    });

    // Borrowed Books Related API

    app.get("/api/borrowedBooks", async (req, res) => {
      const queryEmail = req.query?.email;
      // const tokenEmail = req.user.email;

      // if (queryEmail !== tokenEmail) {
      //   return res
      //     .status(403)
      //     .send({ status: 403, message: "forbidden access" });
      // }

      let query = {};
      if (queryEmail) {
        query = { email: queryEmail };
      }

      const result = await borrowedBooksCollection.find().toArray();
      res.send(result);
    });

    app.post("/api/borrowedBooks", async (req, res) => {
      const newBorrowedBooks = req.body;
      const result = await borrowedBooksCollection.insertOne(newBorrowedBooks);
      res.send(result);
    });

    app.delete("/api/borrowedBooks/:id([0-9a-fA-F]{24})", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await borrowedBooksCollection.deleteOne(query);
      res.send(result);
    });

    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running perfectly");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
