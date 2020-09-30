const { combineResolvers } = require('graphql-resolvers');

const { isAuthenitcated } = require('./authorization.js');

function callback(alreadyRequested) {
  if (alreadyRequested) {
    return {
      __typename: 'CreateProductRequestError',
      message: 'Your have already sent request to this product',
      type: 'CreateProductRequestError',
    };
  }
}

function checkIsAlreadyRequested(
  requestModel,
  requestedBy,
  requestedProduct,
  callback,
) {
  requestModel.findOne(
    {
      requestedBy,
      requestedProduct,
    },
    (err, request) => {
      let alreadyRequested = null;
      if (request) {
        alreadyRequested = request;
        callback(alreadyRequested);
      }
    },
  );
}
module.exports = {
  Query: {
    request: combineResolvers(
      isAuthenitcated,
      async (_, { requestId }, { models: { Request } }) => {
        try {
          const request = await Request.findById(requestId)
            .populate('requestedBy')
            .populate('requestedProduct');
          if (!request) {
            return {
              __typename: 'GetRequestError',
              type: 'GetRequestError',
              message: 'Request does not exist',
            };
          }

          return {
            __typename: 'Request',
            id: request._doc._id,
            ...request._doc,
          };
        } catch (err) {
          return {
            __typename: 'RequestError',
            type: 'RequestError',
            message: 'Unale to get your request',
          };
        }
      },
    ),
    requests: combineResolvers(
      isAuthenitcated,
      async (
        _,
        { byBuyerId, bySellerId },
        { models: { Request } },
      ) => {
        try {
          if (byBuyerId) {
            const requests = await Request.find({
              requestedBy: byBuyerId,
            })
              .populate('requestedBy')
              .populate('requestedProduct');
            return {
              __typename: 'Requests',
              requests,
            };
          }
          if (bySellerId) {
            const requests = await Request.find({
              acceptedByOrDeclinedBy: bySellerId,
            })
              .populate('requestedBy')
              .populate('requestedProduct');
            if (!requests) {
              return {
                __typename: 'RequestsError',
                message:
                  'Current user has no any accepted or declined requests',
                type: 'RequestsError',
              };
            }
            return {
              __typename: 'Requests',
              requests,
            };
          }
          const requests = await Request.find()
            .populate('requestedBy')
            .populate('requestedProduct');
          return {
            __typename: 'Requests',
            requests,
          };
        } catch (err) {
          return {
            __typename: 'RequestsError',
            message: 'Unable to get requests',
            type: `${err}`,
          };
        }
      },
    ),
  },
  Mutation: {
    createProductRequest: combineResolvers(
      isAuthenitcated,
      async (
        _,
        { productId },
        { models: { Request, Product }, currentUser },
      ) => {
        try {
          // validate if product exists already
          const product = await Product.findById(productId);

          if (!product) {
            return {
              __typename: 'GetProductError',
              type: 'GetProductError',
              message: 'Product does not exist',
            };
          }

          if (currentUser.role !== 'BUYER') {
            return {
              __typename: 'CreateProductRequestError',
              message:
                'Your role must be Buyer to send request to product',
              type: 'CreateProductRequestError',
            };
          }

          const isAlreadyRequested = await Request.findOne({
            requestedBy: currentUser.id,
            requestedProduct: productId,
          });

          if (isAlreadyRequested) {
            return {
              __typename: 'CreateProductRequestError',
              message:
                'Your have already sent request to this product',
              type: 'CreateProductRequestError',
            };
          }

          const productRequest = new Request({
            requestStatus: 'REQUESTED',
            requestedBy: currentUser.id,
            requestedProduct: productId,
            createdAt: new Date().toISOString(),
          });

          await productRequest.save();

          const repon = await Request.findById(productRequest._id)
            .populate('requestedBy')
            .populate('requestedProduct')
            .exec();

          return {
            __typename: 'Request',
            id: repon._doc._id,
            ...repon._doc,
          };

          // check if already requested
        } catch (err) {
          return {
            __typename: 'CreateProductRequestError',
            message: 'Unable to send request',
            type: `${err}`,
          };
        }
      },
    ),

    deleteProductRequest: combineResolvers(
      isAuthenitcated,
      async (
        _,
        { requestId },
        { models: { Request }, currentUser },
      ) => {
        try {
          const request = await Request.findById(requestId).populate(
            'requestedBy',
          );
          if (!request) {
            return 'requested does not exist';
          }
          if (request._doc.requestedBy.email !== currentUser.email) {
            return 'Not authenticated as owner of request';
          }
          await Request.deleteOne({ _id: requestId });

          return 'Deleted';
        } catch (err) {
          return 'Unknow error happened while deleting your request';
        }
      },
    ),

    updateProductRequest: combineResolvers(
      isAuthenitcated,
      async (
        _,
        { requestId, requestStatus },
        { models: { Request }, currentUser },
      ) => {
        try {
          const request = await Request.findById(requestId)
            .populate('requestedBy')
            .populate('requestedProduct')
            .exec();
          if (request) {
            if (
              request.requestedProduct.user.email !==
              currentUser.email
            ) {
              return {
                __typename: 'UpdateProductRequestError',
                type: 'UpdateProductRequestError',
                message:
                  'Your are not the owner of the product the request is sent for',
              };
            }
            if (currentUser.role !== 'SUPPLIER') {
              return {
                __typename: 'UpdateProductRequestError',
                type: 'UpdateProductRequestError',
                message:
                  'You must be Supplier to update this request',
              };
            }
            request.requestStatus = requestStatus;
            request.acceptedByOrDeclinedBy = currentUser.id;
            request.createdAt = new Date().toISOString();
            const updatedRequest = await request.save();

            return {
              __typename: 'Request',
              ...updatedRequest._doc,
              id: updatedRequest._doc._id,
            };
          }
          return {
            __typename: 'GetRequestError',
            type: 'GetRequestError',
            message: 'Request does not exist',
          };
        } catch (err) {
          return {
            __typename: 'UpdateProductRequestError',
            type: 'UpdateProductRequestError',
            message: 'Unable to update request',
          };
        }
      },
    ),
  },
};
