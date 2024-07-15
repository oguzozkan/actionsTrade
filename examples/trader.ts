import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  actionSpecOpenApiPostRequestBody,
  actionsSpecOpenApiGetResponse,
  actionsSpecOpenApiPostResponse,
} from '../openapi';
import jupiterApi from '../../api/jupiter-api';
import {
  ActionError,
  ActionGetResponse,
  ActionPostRequest,
  ActionPostResponse,
} from '@solana/actions';

// feat: Add Jupiter logo URL for consistent branding
export const JUPITER_LOGO =
  'https://ucarecdn.com/09c80208-f27c-45dd-b716-75e1e55832c4/-/preview/1000x981/-/quality/smart/-/format/auto/';

// feat: Set profit target for trading bot
const PROFIT_PERCENTAGE = 5; // 5% profit target

const app = new OpenAPIHono();

// feat: Implement GET route for trade information
app.openapi(
  createRoute({
    method: 'get',
    path: '/trade/{tokenPair}',
    tags: ['Jupiter Trade'],
    request: {
      params: z.object({
        tokenPair: z.string().openapi({
          param: {
            name: 'tokenPair',
            in: 'path',
          },
          type: 'string',
          example: 'SOL-USDC',
        }),
      }),
    },
    responses: actionsSpecOpenApiGetResponse,
  }),
  async (c) => {
    const tokenPair = c.req.param('tokenPair');
    const [inputToken, outputToken] = tokenPair.split('-');
    
    // feat: Fetch token metadata for input and output tokens
    const [inputTokenMeta, outputTokenMeta] = await Promise.all([
      jupiterApi.lookupToken(inputToken),
      jupiterApi.lookupToken(outputToken),
    ]);

    // fix: Handle case where token metadata is not found
    if (!inputTokenMeta || !outputTokenMeta) {
      return Response.json({
        icon: JUPITER_LOGO,
        label: 'Not Available',
        title: `Trade ${tokenPair}`,
        description: `Unable to trade ${tokenPair}.`,
        disabled: true,
        error: {
          message: `Token metadata not found.`,
        },
      } satisfies ActionGetResponse);
    }

    // feat: Fetch current token price in USD
    const tokenUsdPrices = await jupiterApi.getTokenPricesInUsdc([
      inputTokenMeta.address,
    ]);
    const currentPrice = tokenUsdPrices[inputTokenMeta.address]?.price;
    
    // fix: Handle case where price fetch fails
    if (!currentPrice) {
      return Response.json({
        icon: JUPITER_LOGO,
        label: 'Not Available',
        title: `Trade ${tokenPair}`,
        description: `Unable to trade ${tokenPair}.`,
        disabled: true,
        error: {
          message: `Failed to get price for ${inputTokenMeta.symbol}.`,
        },
      } satisfies ActionGetResponse);
    }

    // feat: Calculate profitable price based on current price and profit target
    const profitablePrice = currentPrice * (1 + PROFIT_PERCENTAGE / 100);

    // feat: Construct response with trade information
    const response: ActionGetResponse = {
      icon: JUPITER_LOGO,
      label: `Sell ${inputTokenMeta.symbol} at ${profitablePrice.toFixed(2)} ${outputTokenMeta.symbol}`,
      title: `Trade ${tokenPair}`,
      description: `Place a sell order for ${inputTokenMeta.symbol} when the price reaches ${profitablePrice.toFixed(2)} ${outputTokenMeta.symbol} (${PROFIT_PERCENTAGE}% profit).`,
    };

    return c.json(response);
  },
);

// feat: Implement POST route for executing trades
app.openapi(
  createRoute({
    method: 'post',
    path: '/trade/{tokenPair}',
    tags: ['Jupiter Trade'],
    request: {
      params: z.object({
        tokenPair: z.string().openapi({
          param: {
            name: 'tokenPair',
            in: 'path',
          },
          type: 'string',
          example: 'SOL-USDC',
        }),
      }),
      body: actionSpecOpenApiPostRequestBody,
    },
    responses: actionsSpecOpenApiPostResponse,
  }),
  async (c) => {
    const tokenPair = c.req.param('tokenPair');
    const { account } = (await c.req.json()) as ActionPostRequest;

    const [inputToken, outputToken] = tokenPair.split('-');
    
    // feat: Fetch token metadata for input and output tokens
    const [inputTokenMeta, outputTokenMeta] = await Promise.all([
      jupiterApi.lookupToken(inputToken),
      jupiterApi.lookupToken(outputToken),
    ]);

    // fix: Handle case where token metadata is not found
    if (!inputTokenMeta || !outputTokenMeta) {
      return Response.json(
        {
          message: `Token metadata not found.`,
        } satisfies ActionError,
        {
          status: 422,
        },
      );
    }

    // feat: Fetch current token price in USD
    const tokenUsdPrices = await jupiterApi.getTokenPricesInUsdc([
      inputTokenMeta.address,
    ]);
    const currentPrice = tokenUsdPrices[inputTokenMeta.address]?.price;
    
    // fix: Handle case where price fetch fails
    if (!currentPrice) {
      return Response.json(
        {
          message: `Failed to get price for ${inputTokenMeta.symbol}.`,
        } satisfies ActionError,
        {
          status: 422,
        },
      );
    }

    // feat: Calculate profitable price and set input amount
    const profitablePrice = currentPrice * (1 + PROFIT_PERCENTAGE / 100);
    const inputAmount = 1 * 10 ** inputTokenMeta.decimals; // TODO: Allow custom amount input

    // feat: Get quote for the trade
    const quote = await jupiterApi.quoteGet({
      inputMint: inputTokenMeta.address,
      outputMint: outputTokenMeta.address,
      amount: inputAmount,
      autoSlippage: true,
      maxAutoSlippageBps: 500, // 5%
    });

    // feat: Execute the trade using Jupiter's swap function
    const swapResponse = await jupiterApi.swapPost({
      swapRequest: {
        quoteResponse: quote,
        userPublicKey: account,
        prioritizationFeeLamports: 'auto',
      },
    });

    // feat: Construct response with transaction details
    const response: ActionPostResponse = {
      transaction: swapResponse.swapTransaction,
    };

    return c.json(response);
  },
);

export default app;
