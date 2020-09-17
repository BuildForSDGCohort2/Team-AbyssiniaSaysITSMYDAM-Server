// add your dependecy imports here
require('dotenv').config();
const {
  ApolloServer,
  AuthenticationError,
} = require('apollo-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
// const express = require('express');
// const cors = require('cors');

// add your relative imports here
const schema = require('./schema');
const resolvers = require('./resolvers');
const models = require('./models');

// const app = express();
// app.use(cors());

// PORT
const PORT = process.env.PORT || 5000;

// current authenticated user
const getCurrentUser = async (req) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split('Bearer ')[1];

    if (token) {
      try {
        const user = await jwt.verify(token, process.env.SECRET);
        console.log(user);
        return user;
      } catch (e) {
        return null;
      }
    }
    // if token is not in right format
    throw new Error("Token is not in a format 'Bearer token' ");
  }
};

const server = new ApolloServer({
  typeDefs: schema,
  resolvers,
  context: async ({ req }) => {
    const currentUser = await getCurrentUser(req);
    return {
      models,
      currentUser,
      secret: process.env.SECRET,
    };
  },
});

mongoose
  .connect(process.env.MONGO_ATLAS_DB_CONNECTION_STRING, {
    useNewUrlParser: true,
    useFindAndModify: false,
  })
  .then(() => {
    console.log('Mongo db connected!');
    return server.listen({ port: PORT });
  })
  .then((res) => {
    console.log(`Running at  ${res.url}`);
  })
  .catch((err) => {
    console.log(err);
  });
