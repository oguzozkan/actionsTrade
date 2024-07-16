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
  'https://madlads.s3.us-west-2.amazonaws.com/images/1405.png';

const SWAP_AMOUNT_USD_OPTIONS = [10, 100, 1000];
const DEFAULT_SWAP_AMOUNT_USD = 10;
const US_DOLLAR_FORMATTING = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const app = new OpenAPIHono();

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
        title: `Ape into ${outputToken}`,
        description: `Ape into ${outputToken} with ${inputToken}.`,
        disabled: true,
        error: {
          message: `Token metadata ghosted us. Much sadness.`,
        },
      } satisfies ActionGetResponse);
    }

    const amountParameterName = 'amount';
    const response: ActionGetResponse = {
      icon: JUPITER_LOGO,
      label: `Ape into ${outputTokenMeta.symbol}`,
      title: `Ape into ${outputTokenMeta.symbol}`,
      description: `Ape into ${outputTokenMeta.symbol} with your ${inputTokenMeta.symbol} stash. Pick a YOLO amount of ${inputTokenMeta.symbol} from the options below, or go full degen with a custom amount.`,
      links: {
        actions: [
          ...SWAP_AMOUNT_USD_OPTIONS.map((amount, index) => ({
            label: `${US_DOLLAR_FORMATTING.format(amount)} ${getHumorousLabel(index)}`,
            href: `/api/jupiter/swap/${tokenPair}/${amount}`,
          })),
          {
            href: `/api/jupiter/swap/${tokenPair}/{${amountParameterName}}`,
            label: `Ape into ${outputTokenMeta.symbol} like there's no tomorrow`,
            parameters: [
              {
                name: amountParameterName,
                label: 'Enter a custom YOLO amount',
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
        title: `Ape into ${outputToken}`,
        description: `Ape into ${outputToken} with ${inputToken}.`,
        disabled: true,
        error: {
          message: `Token metadata ghosted us. Much sadness.`,
        },
      } satisfies ActionGetResponse);
    }

    const response: ActionGetResponse = {
      icon: JUPITER_LOGO,
      label: `Ape into ${outputTokenMeta.symbol}`,
      title: `Ape into ${outputTokenMeta.symbol} with ${inputTokenMeta.symbol}`,
      description: `Ape into ${outputTokenMeta.symbol} with ${inputTokenMeta.symbol}. Warning: This Action is as unregistered as your crypto gains. Only use it if you trust the source more than your ex. This Action won't go viral on X until it's officially a thing.`,
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
          message: `Token metadata ghosted us. Much sadness.`,
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
          message: `Failed to get price for ${inputTokenMeta.symbol}. The oracle must be on vacation.`,
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
      `YOLOing ${tokenAmountFractional} ${inputTokenMeta.symbol} into ${outputTokenMeta.symbol}    
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
      maxAutoSlippageBps: 500, // 5%, because we like to live dangerously
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

function getHumorousLabel(index: number): string {
  const labels = [
    "(AKA one ramen packet)",
    "(Your entire \"food\" budget)",
    "(Rent? What rent?)"
  ];
  return labels[index] || "";
}

export default app;
