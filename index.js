const express = require('express')
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
// This is your test secret API key.
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// safe to use Axios secure
// classes route, where i'm showing all the classes
// instructor route where im showing all the instructors.
// 

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.static("public"));
app.use(express.json());

// middlewares 
const verifyToken = (req, res, next) => {
  // console.log('inside verify token', req.headers.authorization);
  if (!req.headers.authorization) {
    return res.status(401).send({ message: 'unauthorized access' });
  }
  const token = req.headers.authorization.split(' ')[1];
  // console.log("🚀 ~ verifyToken ~ token:", token);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    // console.log("🚀 ~ jwt.verify ~ decoded:", decoded);
    if (err) {
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
};



app.get('/', (req, res) => {
  res.send('summer camp school server is running!')
});


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.iegqqxy.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const summerCampSchoolUserCollection = client.db('summerCampSchool').collection('users');
    const summerCampSchoolBannerCollection = client.db('summerCampSchool').collection('banner');
    const summerCampSchoolCurriculumCollection = client.db('summerCampSchool').collection('curriculum');
    const summerCampSchoolClassesCollection = client.db('summerCampSchool').collection('classes');
    const summerCampSchoolReviewsCollection = client.db('summerCampSchool').collection('reviews');
    const summerCampSchoolCartsCollection = client.db('summerCampSchool').collection('carts');
    const summerCampSchoolPaymentCollection = client.db('summerCampSchool').collection('payments');

    // jwt related api
    app.post('/jwt', async (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    });

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await summerCampSchoolUserCollection.findOne(query);
      const isAdmin = user.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    };

    // banner data
    // images and description
    app.get('/banner', async (req, res) => {
      const result = await summerCampSchoolBannerCollection.find().toArray();
      res.send(result);
    });

    // curriculum
    app.get('/curriculum', async (req, res) => {
      const result = await summerCampSchoolCurriculumCollection.find().toArray();
      res.send(result);
    });


    // for all the classes
    // using it in the classes route
    app.get('/classes', verifyToken, async (req, res) => {
      const result = await summerCampSchoolClassesCollection.find().toArray();
      // console.log("🚀 ~ app.get ~ result:", result);
      res.send(result);
    });

    // for admin to update class status.
    app.patch('/classes', verifyToken, verifyAdmin, async (req, res) => {
      const { id, status } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: status
        },
      }
      const result = await summerCampSchoolClassesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // purchased classes of the students
    //  for admin to manage the students.
    app.get('/classes/:classId', async (req, res) => {
      const { classId } = req.params;
      /* console.log("🚀 ~ app.get ~ classId:", classId);
      const classObjectIdString = classId;
      const pipeline = [
        {
          $unwind: '$classes_id'
        },
        {
          $match: {
            _id: classObjectIdString
          }
        },
        {
          $lookup: {
            from: 'payments',
            localField: '_id',
            foreignField: 'classes_id',
            as: 'userDetails'
          }
        },
        {
          $unwind: '$userDetails'
        },
        {
          $project: {
            _id: 0,
            user_id: 1,
            email: '$userDetails.email',
            name: '$userDetails.name'
          }
        }
      ];

      const result = await summerCampSchoolClassesCollection.aggregate(pipeline).toArray();

      return res.send(result); */

      // Find payments with the class ID
      const payments = await summerCampSchoolPaymentCollection.find({
        classes_id: { $in: [classId] } // Use $in operator to search for classId in the array
      }).toArray();

      // Collect unique user emails from payments
      // const userEmails = new Set();
      let userInfo;
      for (const payment of payments) {
        console.log("🚀 ~ app.get ~ payment:", payment);

        // Assuming "user_email" field stores user email in payments collection
        userInfo = [
          {
            email: payment.email, purchaseDate: payment.purchaseDate, transactionId: payment.transactionId
          }
        ];
        /* if (userEmail) {
          userEmails.add(userEmail);
        } else {
          console.warn(`Payment with class ID "${classId}" is missing user email`);
        } */
      }

      res.send(userInfo);
    });

    // for updating the student enrolled seats on specific classes
    app.patch('/classes/:id', async (req, res) => {
      const { id } = req.params;
      const filter = { _id: new ObjectId(id) };
      const updateStudentEnrolledSeats = req.body;
      // console.log("🚀 ~ app.patch ~ updateStudentEnrolledSeats:", updateStudentEnrolledSeats);
      const updateDoc = {
        $set: {
          students_enrolled: updateStudentEnrolledSeats.students_enrolled,
        },
      }
      // console.log("🚀 ~ app.patch ~ updateDoc:", updateDoc);
      const result = await summerCampSchoolClassesCollection.updateOne(filter, updateDoc);
      // console.log("🚀 ~ app.patch ~ result:", result);

      return res.send(result);
    });

    // for specific instructor classes
    app.get('/classes/:instructorId', verifyToken, async (req, res) => {
      const { instructorId } = req.params;
      // // // console.log("🚀 ~ app.get ~ instructorId:", instructorId);
      const result = await summerCampSchoolClassesCollection.find({ instructor_id: instructorId }).toArray();
      res.send(result);
    });

    // * here is the api for popular classes
    // * i'm deciding popular classes based on their available seats and students enrolled in that class if the students enrolled are 70% of the available seats then that class is popular
    app.get('/popularclasses', async (req, res) => {
      const pipeline = [
        {
          $project: {
            _id: 1,
            className: 1,
            available_seats: 1,
            students_enrolled: 1,
            category: 1,
            description: 1,
            class_thumbnail: 1,
            rating: 1,
            price: 1,
            instructor_name: 1,
            percentage: {
              $multiply: [
                { $divide: ["$students_enrolled", "$available_seats"] },
                100
              ]
            }
          }
        },
        {
          $match: {
            percentage: { $gte: 70 } // Filter classes with percentage >= 70%
          }
        }
      ];

      const result = await summerCampSchoolClassesCollection.aggregate(pipeline).toArray();

      res.send(result);
    });


    // * this is for getting all the users
    // this is for admin only
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      // const userEmail = req?.query?.email;
      // console.log("🚀 ~ app.get ~ userEmail:", userEmail);

      // const query = { email: userEmail }
      const result = await summerCampSchoolUserCollection.find().toArray();
      res.send(result);
    });


    // updates user role, this is for admin only
    app.patch('/users', async (req, res) => {
      const email = req.query.email;
      console.log("🚀 ~ app.patch ~ email:", email);
      const { role, class_id } = req.body;
      // console.log("🚀 ~ app.patch ~ role:", role);
      console.log("🚀 ~ app.patch ~ class_id:", class_id);
      const query = { email: email };
      let updateDoc;
      if (role) {
        updateDoc = {
          $set: {
            role: role
          }
        }
      } else if (class_id) {
        updateDoc = {
          $addToSet: {
            banned_classes: class_id
          }
        };


      }

      try {
        const result = await summerCampSchoolUserCollection.updateOne(query, updateDoc);
        return res.send(result);
      } catch (error) {
        console.error("Error updating user:", error);
        return res.status(500).send({ error: "An error occurred while updating the user." });
      }
    });

    // saving user info to the database.
    app.post('/users', async (req, res) => {
      const { userInfo } = req.body;
      const query = { email: userInfo.email }
      const existingUser = await summerCampSchoolUserCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      const result = await summerCampSchoolUserCollection.insertOne(userInfo);
      return res.send(result);
    });

    // get single user info form the database
    app.get('/users/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await summerCampSchoolUserCollection.findOne(query);
      res.send(result);
    });

    // check if a user is an admin or not
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        return res.send({ admin: false });
      }

      const query = { email: email };
      const user = await summerCampSchoolUserCollection.findOne(query);
      const result = { admin: user.role === 'admin' };
      res.send(result);
    });

    // save users more info to database
    app.post('/users/save-user-data', async (req, res) => {
      const { email, bio, address, phone, gender } = req.body;
      const result = await summerCampSchoolUserCollection.updateOne(
        { email },
        {
          $set: {
            bio,
            address,
            phone,
            gender
          }
        },
        { upsert: false }
      );
      res.send(result);
    });

    // follow a specific instructor
    app.put('/users/follow/:instructorId', async (req, res) => {
      const { instructorId } = req.params;
      const { userEmail } = req.body;
      // Update user document to include the followed instructor's _id
      await summerCampSchoolUserCollection.updateOne(
        { email: userEmail },
        { $addToSet: { following: instructorId } }
      );

      res.send({ message: 'Successfully followed instructor.' });
    });


    // delete / unfollow specific instructor
    app.patch('/users/unfollow/:instructorId', async (req, res) => {
      const { instructorId } = req.params;
      const { userEmail } = req.body;

      // Find the user document using the email
      const user = await summerCampSchoolUserCollection.findOne({ email: userEmail });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Remove the instructorId from the list of followed instructors
      const updatedFollowedInstructors = user.following.filter(id => id !== instructorId);

      // Update the user document in the database with the new list of followed instructors
      await summerCampSchoolUserCollection.updateOne(
        { email: userEmail },
        { $set: { following: updatedFollowedInstructors } }
      );

      res.status(200).json({ message: 'Successfully unfollowed instructor' });
    });

    // * for add to cart
    app.post('/carts', async (req, res) => {
      const email = req.query.email;
      const addedToCart = req.body;
      const result = await summerCampSchoolCartsCollection.insertOne(addedToCart);
      return res.send(result);
    });

    // delete a specific item from cart
    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await summerCampSchoolCartsCollection.deleteOne(query);
      res.send(result);
    });

    // * get specific user booked data
    app.get('/carts', verifyToken, async (req, res) => {
      const email = req.query.email;
      const result = await summerCampSchoolCartsCollection.find({ email: email }).toArray();
      return res.send(result);
    });

    // store all payment information to database.
    app.post('/payment', async (req, res) => {
      const { email,
        transactionId,
        totalPrice,
        purchaseDate,
        classes_id,
        carts_id } = req.body.payment;

      const date = new Date(purchaseDate);
      const newPayment = {
        email,
        transactionId,
        totalPrice,
        purchaseDate: date,
        classes_id,
        carts_id
      };

      const insertedResult = await summerCampSchoolPaymentCollection.insertOne(newPayment);
      const query = { _id: { $in: newPayment.carts_id.map(_id => new ObjectId(_id)) } };
      const deletedResult = await summerCampSchoolCartsCollection.deleteMany(query);

      res.send({ insertedResult, deletedResult });
    });

    // get all the payment of a specific user
    app.get('/payments', verifyToken, async (req, res) => {
      const user = req.query.email;
      // console.log("🚀 ~ app.get ~ user:", user);

      // const result = await summerCampSchoolPaymentCollection.find({ email: user }).toArray();

      if (!user) {
        return res.status(400).send({ message: 'Email query parameter is required' });
      }

      const pipeline = [
        {
          $match: { email: user } // Filter payments by user email
        },
        {
          $unwind: '$classes_id' // Unwind the classes_id array
        },
        {
          $addFields: {
            classes_id: { $toObjectId: '$classes_id' }
          } // Convert classes_id to ObjectId
        },
        {
          $lookup: {
            from: 'classes',
            localField: 'classes_id',
            foreignField: '_id',
            as: 'classInfo'
          }
        },
        {
          $unwind: '$classInfo' // Unwind the resulting classInfo array
        },
        {
          $project: {
            transactionId: 1,
            email: 1,
            purchaseDate: 1,
            totalPrice: 1,
            className: '$classInfo.className',
            class_thumbnail: '$classInfo.class_thumbnail'
          }
        },
        {
          $sort: { purchaseDate: -1 } // Sort by purchaseDate in descending order
        }
      ];

      const results = await summerCampSchoolPaymentCollection.aggregate(pipeline).toArray();
      // console.log("🚀 ~ app.get ~ results:", results);

      return res.send(results);
    });

    // paid user classes
    app.get('/payments/classes', verifyToken, async (req, res) => {
      const email = req.query.email;
      // console.log("🚀 ~ app.get ~ email:", email);
      // const db = await connectToDatabase();

      try {
        // Find all payments for the user
        const payments = await summerCampSchoolPaymentCollection.find({ email: email }).toArray();
        // console.log("🚀 ~ app.get ~ payments:", payments);

        if (payments.length === 0) {
          return res.status(404).send('No successful payments found for this user.');
        }

        /* // Extract the classes_ids from the payments
        // const query = payments?.classes_id?.map(id => new ObjectId(id));
        const query = { _id: { $in: payments?.classes_id?.map(id => new ObjectId(id)) } };

        // Fetch the class details
        const classes = await summerCampSchoolClassesCollection.find(query).toArray(); */

        /* // Extract the classes_ids from the payments
        const classesIds = payments.map(payment => payment.classes_id).filter(Boolean);
        // console.log("🚀 ~ app.get ~ classesIds:", classesIds);

        if (classesIds.length === 0) {
          return res.status(404).send('No classes found for the successful payments.');
        }

        // Form the query
        const query = { _id: { $in: classesIds.map(id => new ObjectId(id)) } };

        // Fetch the class details
        const classes = await summerCampSchoolClassesCollection.find(query).toArray(); */
        // ! $in aie method gula sikha.
        // ! concat method ta sikha.

        // Extract class IDs from successful payments
        const classIds = payments.map(payment => payment.classes_id);
        // console.log("🚀 ~ app.get ~ classIds:", classIds);

        const flattenedClassIds = [].concat(...classIds);
        // console.log("🚀 ~ app.get ~ flattenedClassIds:", flattenedClassIds);

        // Find classes corresponding to the class IDs
        const userClasses = await summerCampSchoolClassesCollection.find({ _id: { $in: flattenedClassIds.map(id => new ObjectId(id)) } }).toArray();
        // console.log("🚀 ~ app.get ~ userClasses:", userClasses);

        res.send(userClasses);
        // res.send('fixing');
      } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
      }
    });

    // * for getting all instructors
    app.get('/instructors', verifyToken, async (req, res) => {
      const result = await summerCampSchoolUserCollection.find({ role: "instructor" }).toArray();
      res.send(result);
    });

    // * popular instructor
    app.get('/popularinstructor', async (req, res) => {

      const pipeline = [
        // Match users with role 'instructor'
        { $match: { role: 'instructor' } },
        // Convert _id to string
        { $addFields: { "_id": { $toString: "$_id" } } },

        // Lookup classes by instructor_id
        {
          $lookup: {
            from: 'classes',
            localField: '_id',
            foreignField: 'instructor_id',
            as: 'classes'
          }
        },
        // Unwind classes array
        { $unwind: '$classes' },
        // Calculate the ratio of students enrolled to available seats
        {
          $addFields: {
            popularityRatio: { $divide: ['$classes.students_enrolled', '$classes.available_seats'] }
          }
        },
        // Filter instructors with popularity ratio >= 0.7
        { $match: { popularityRatio: { $gte: 0.7 } } },
        // Group by instructor and collect class names
        {
          $group: {
            _id: '$_id',
            instructorName: { $first: '$name' },
            image: { $first: '$image' }, // Assuming 'image' field exists in users collection
            classesNames: { $push: '$classes.className' } // Assuming 'className' field exists in classes collection
          }
        },
        // Sort by instructor name
        { $sort: { instructorName: 1 } }
      ];

      const result = await summerCampSchoolUserCollection.aggregate(pipeline).toArray();
      res.send(result);
    });

    // payment-intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      // // console.log("🚀 ~ app.post ~ price:", typeof (price));
      // // console.log("🚀 ~ app.post ~ price:", price);

      const amount = price * 100;
      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // reviews
    app.get('/reviews', async (req, res) => {
      const result = await summerCampSchoolReviewsCollection.find().toArray();
      res.send(result);
    });

    // stats for showing on the homepage
    app.get('/stats', async (req, res) => {
      // Get total amount of classes
      const classesCount = await summerCampSchoolClassesCollection.countDocuments();

      // Get amount of members
      const membersCount = await summerCampSchoolUserCollection.countDocuments({ role: { $ne: 'instructor' } });

      const instructorCount = await summerCampSchoolUserCollection.countDocuments({ role: 'instructor' });

      // Calculate average rating
      const reviews = await summerCampSchoolReviewsCollection.find().toArray();
      const totalRatings = reviews.reduce((sum, review) => sum + review.rating, 0);
      const averageRating = (totalRatings / reviews.length).toFixed(2);

      // Prepare response object
      // here I'm returning the data
      const stats = [
        { classes: classesCount },
        { members: membersCount },
        { instructor: instructorCount },
        { 'average rating': averageRating },
      ];

      // Send response
      res.send(stats);
    });


    /* ------------------------------------------------ */
    // * Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.listen(port, () => {
  console.log(`summer camp school app listening on port ${port}`)
});