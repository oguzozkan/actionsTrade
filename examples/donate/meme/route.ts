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

export const JUPITER_LOGO =
  'https://imageresizer.xnftdata.com/anim=true,fit=contain,width=600,height=600,quality=85/https://madlads.s3.us-west-2.amazonaws.com/images/1405.png';

const SWAP_AMOUNT_USD_OPTIONS = [10, 100, 1000];
const DEFAULT_SWAP_AMOUNT_USD = 10;
const US_DOLLAR_FORMATTING = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const getRandomToken = () => {
  const tokens = ['WIF', 'BONK'];
  return tokens[Math.floor(Math.random() * tokens.length)];
};

const app = new OpenAPIHono();

// New endpoint for random token selection
app.openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['Jupiter Swap'],
    responses: actionsSpecOpenApiGetResponse,
  }),
  async (c) => {
    const randomToken = getRandomToken();
    const tokenPair = `${randomToken}-SOL`;
    
    const [inputTokenMeta, outputTokenMeta] = await Promise.all([
      jupiterApi.lookupToken(randomToken),
      jupiterApi.lookupToken('SOL'),
    ]);

    if (!inputTokenMeta || !outputTokenMeta) {
      return Response.json({
        icon: JUPITER_LOGO,
        label: 'Not Available',
        title: `Random Swap`,
        description: `Swap randomly selected token with SOL.`,
        disabled: true,
        error: {
          message: `Token metadata not found.`,
        },
      } satisfies ActionGetResponse);
    }

    const amountParameterName = 'amount';
    const response: ActionGetResponse = {
      icon: JUPITER_LOGO,
      label: `Swap ${inputTokenMeta.symbol} for SOL`,
      title: `Random Swap: ${inputTokenMeta.symbol} to SOL`,
      description: `Randomly selected to swap ${inputTokenMeta.symbol} for SOL. Choose a USD amount or enter a custom amount.`,
      links: {
        actions: [
          ...SWAP_AMOUNT_USD_OPTIONS.map((amount) => ({
            label: `${US_DOLLAR_FORMATTING.format(amount)}`,
            href: `/api/trader/swap/${tokenPair}/${amount}`,
          })),
          {
            href: `/api/trader/swap/${tokenPair}/{${amountParameterName}}`,
            label: `Swap ${inputTokenMeta.symbol}`,
            parameters: [
              {
                name: amountParameterName,
                label: 'Enter a custom USD amount',
              },
            ],
          },
        ],
      },
    };

    return c.json(response);
  },
);

// Existing endpoint for specific token pair
app.openapi(
  createRoute({
    method: 'get',
    path: '/{tokenPair}',
    tags: ['Jupiter Swap'],
    request: {
      params: z.object({
        tokenPair: z.string().openapi({
          param: {
            name: 'tokenPair',
            in: 'path',
          },
          type: 'string',
          example: 'USDC-SOL',
        }),
      }),
    },
    responses: actionsSpecOpenApiGetResponse,
  }),
  async (c) => {
    const tokenPair = c.req.param('tokenPair');

    const [inputToken, outputToken] = tokenPair.split('-');
    const [inputTokenMeta, outputTokenMeta] = await Promise.all([
      jupiterApi.lookupToken(inputToken),
      jupiterApi.lookupToken(outputToken),
    ]);

    if (!inputTokenMeta || !outputTokenMeta) {
      return Response.json({
        icon: JUPITER_LOGO,
        label: 'Not Available',
        title: `Buy ${outputToken}`,
        description: `Buy ${outputToken} with ${inputToken}.`,
        disabled: true,
        error: {
          message: `Token metadata not found.`,
        },
      } satisfies ActionGetResponse);
    }

    const amountParameterName = 'amount';
    const response: ActionGetResponse = {
      icon: JUPITER_LOGO,
      label: `Buy ${outputTokenMeta.symbol}`,
      title: `Buy ${outputTokenMeta.symbol}`,
      description: `Buy ${outputTokenMeta.symbol} with ${inputTokenMeta.symbol}. Choose a USD amount of ${inputTokenMeta.symbol} from the options below, or enter a custom amount.`,
      links: {
        actions: [
          ...SWAP_AMOUNT_USD_OPTIONS.map((amount) => ({
            label: `${US_DOLLAR_FORMATTING.format(amount)}`,
            href: `/api/trader/swap/${tokenPair}/${amount}`,
          })),
          {
            href: `/api/trader/swap/${tokenPair}/{${amountParameterName}}`,
            label: `Buy ${outputTokenMeta.symbol}`,
            parameters: [
              {
                name: amountParameterName,
                label: 'Enter a custom USD amount',
              },
            ],
          },
        ],
      },
    };

    return c.json(response);
  },
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/{tokenPair}/{amount}',
    tags: ['Jupiter Swap'],
    request: {
      params: z.object({
        tokenPair: z.string().openapi({
          param: {
            name: 'tokenPair',
            in: 'path',
          },
          type: 'string',
          example: 'USDC-SOL',
        }),
        amount: z
          .string()
          .optional()
          .openapi({
            param: {
              name: 'amount',
              in: 'path',
              required: false,
            },
            type: 'number',
            example: '1',
          }),
      }),
    },
    responses: actionsSpecOpenApiGetResponse,
  }),
  async (c) => {
    const { tokenPair } = c.req.param();
    const [inputToken, outputToken] = tokenPair.split('-');
    const [inputTokenMeta, outputTokenMeta] = await Promise.all([
      jupiterApi.lookupToken(inputToken),
      jupiterApi.lookupToken(outputToken),
    ]);

    if (!inputTokenMeta || !outputTokenMeta) {
      return Response.json({
        icon: JUPITER_LOGO,
        label: 'Not Available',
        title: `Buy ${outputToken}`,
        description: `Buy ${outputToken} with ${inputToken}.`,
        disabled: true,
        error: {
          message: `Token metadata not found.`,
        },
      } satisfies ActionGetResponse);
    }

    const response: ActionGetResponse = {
      icon: JUPITER_LOGO,
      label: `Buy ${outputTokenMeta.symbol}`,
      title: `Buy ${outputTokenMeta.symbol} with ${inputTokenMeta.symbol}`,
      description: `Buy ${outputTokenMeta.symbol} with ${inputTokenMeta.symbol}.`,
    };

    return c.json(response);
  },
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/{tokenPair}/{amount}',
    tags: ['Jupiter Swap'],
    request: {
      params: z.object({
        tokenPair: z.string().openapi({
          param: {
            name: 'tokenPair',
            in: 'path',
          },
          type: 'string',
          example: 'USDC-SOL',
        }),
        amount: z
          .string()
          .optional()
          .openapi({
            param: {
              name: 'amount',
              in: 'path',
              required: false,
            },
            type: 'number',
            example: '1',
          }),
      }),
      body: actionSpecOpenApiPostRequestBody,
    },
    responses: actionsSpecOpenApiPostResponse,
  }),
  async (c) => {
    const tokenPair = c.req.param('tokenPair');
    const amount = c.req.param('amount') ?? DEFAULT_SWAP_AMOUNT_USD.toString();
    const { account } = (await c.req.json()) as ActionPostRequest;

    const [inputToken, outputToken] = tokenPair.split('-');
    const [inputTokenMeta, outputTokenMeta] = await Promise.all([
      jupiterApi.lookupToken(inputToken),
      jupiterApi.lookupToken(outputToken),
    ]);

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
    const tokenUsdPrices = await jupiterApi.getTokenPricesInUsdc([
      inputTokenMeta.address,
    ]);
    const tokenPriceUsd = tokenUsdPrices[inputTokenMeta.address];
    if (!tokenPriceUsd) {
      return Response.json(
        {
          message: `Failed to get price for ${inputTokenMeta.symbol}.`,
        } satisfies ActionError,
        {
          status: 422,
        },
      );
    }
    const tokenAmount = parseFloat(amount) / tokenPriceUsd.price;
    const tokenAmountFractional = Math.ceil(
      tokenAmount * 10 ** inputTokenMeta.decimals,
    );
    console.log(
      `Swapping ${tokenAmountFractional} ${inputTokenMeta.symbol} to ${outputTokenMeta.symbol}    
  usd amount: ${amount}
  token usd price: ${tokenPriceUsd.price}
  token amount: ${tokenAmount}
  token amount fractional: ${tokenAmountFractional}`,
    );

    const quote = await jupiterApi.quoteGet({
      inputMint: inputTokenMeta.address,
      outputMint: outputTokenMeta.address,
      amount: tokenAmountFractional,
      autoSlippage: true,
      maxAutoSlippageBps: 500, // 5%,
    });
    const swapResponse = await jupiterApi.swapPost({
      swapRequest: {
        quoteResponse: quote,
        userPublicKey: account,
        prioritizationFeeLamports: 'auto',
      },
    });
    const response: ActionPostResponse = {
      transaction: swapResponse.swapTransaction,
    };
    return c.json(response);
  },
);

export default app;