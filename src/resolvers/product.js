const { UserInputError, ForbiddenError } = require('apollo-server');
const { combineResolvers } = require('graphql-resolvers');

const {
  isAuthenitcated,
  isProductOwner,
} = require('./authorization.js');
module.exports = {
  Mutation: {
    postProduct: combineResolvers(
      isAuthenitcated,
      async (
        parent,
        { product: { productName, uniqueAttributes }, company },
        { models: { Product }, currentUser: { email, role } },
      ) => {
        try {
          const newProduct = new Product({
            productName,
            uniqueAttributes,
            user: {
              email,
              role,
              company,
            },
          });

          const res = await newProduct.save();

          return {
            ...res._doc,
            id: res._id,
          };
        } catch (err) {
          console.log(err);
        }
      },
    ),

    deleteProductPost: combineResolvers(
      isAuthenitcated,
      isProductOwner,
      async (parent, { id }, { models: { Product } }) => {
        try {
          const product = await Product.findById(id);

          await product.delete();
          return 'Deletion successful';
        } catch (err) {
          throw new Error(err);
        }
      },
    ),
    updateProduct: combineResolvers(
      isAuthenitcated,
      isProductOwner,
      async (_, { id, productToBeUpdated }, { models: { Product } }) => {
        try {
          const product = await Product.findByIdAndUpdate(id, productToBeUpdated);
          return product;
        } catch (err) {
          throw new Error(err);
        }
      },
    ),
  },

  Query: {
    async products(_, { filter }, { models: { Product } }) {
      try {
        const products = await Product.find();
        if (!filter) {
          return products;
        }
        return products.filter((product) => {
          const productName = product.productName.toLowerCase().includes(filter);
          const group = product.uniqueAttributes.group.toLowerCase().includes(filter);
          const uniqueName = product.uniqueAttributes.uniqueName.toLowerCase().includes(filter);
          return productName || group || uniqueName;
        });
      } catch (err) {
        throw new Error(err);
      }
    },
    async product(_, { id }, { models: { Product } }) {
      try {
        const product = await Product.findById(id);
        return product;
      } catch (err) {
        throw new Error(err);
      }
    },
  },
};
