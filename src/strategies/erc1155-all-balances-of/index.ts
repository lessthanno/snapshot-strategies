import { getAddress } from '@ethersproject/address';
import { subgraphRequest } from '../../utils';

export const author = 'snapshot-labs';
export const version = '0.2.0';

const SUBGRAPH_URL = {
  '1': 'https://subgrapher.snapshot.org/subgraph/arbitrum/8cDX3UAptW4mvQDpTDyVDvW7cbYC6bgT3yeYrid7FFPA'
};

const HOSTED_SUBGRAPH_URL = {
  // '137': 'https://api.thegraph.com/subgraphs/name/tranchien2002/eip1155-matic' // subgraph doesn't exist anymore
};

export async function strategy(
  _space,
  network,
  _provider,
  addresses,
  options,
  snapshot
) {
  const PAGE_SIZE = 1000;
  let result = [];
  let page = 0;

  const isHosted = HOSTED_SUBGRAPH_URL[network] !== undefined;
  const subgraphURL = isHosted
    ? HOSTED_SUBGRAPH_URL[network]
    : SUBGRAPH_URL[network];

  if (!subgraphURL) {
    throw new Error(`Unsupported network with id:${network}`);
  }

  const eip1155BalancesParams: any = {
    balances: {
      __aliasFor: 'erc1155Balances',
      __args: {
        first: PAGE_SIZE,
        skip: 0,
        where: {
          account_in: addresses.map((a) => a.toLowerCase()),
          token_starts_with: options.address.toLowerCase(),
          value_not: '0'
        }
      },
      account: {
        id: true
      },
      value: true,
      valueExact: true
    }
  };
  if (snapshot !== 'latest') {
    eip1155BalancesParams.balances.__args.block = { number: snapshot };
  }

  // No erc1155balances alias and valueExact for hosted subgraph
  if (isHosted) {
    delete eip1155BalancesParams.balances.__aliasFor;
    delete eip1155BalancesParams.balances.valueExact;
  }

  while (true) {
    eip1155BalancesParams.balances.__args.skip = page * PAGE_SIZE;
    const pageResult = await subgraphRequest(
      subgraphURL,
      eip1155BalancesParams
    );
    const pageERC1155Balances = pageResult.balances || [];
    result = result.concat(pageERC1155Balances);
    page++;
    if (pageERC1155Balances.length < PAGE_SIZE) break;
    // hosted subgraph doesn't support skip more than 5000
    if (isHosted && page === 6) break;
  }

  return result.reduce(
    (
      acc,
      val: { value: string; valueExact: string; account: { id: string } }
    ) => {
      const address = getAddress(val.account.id);
      const value = parseInt(isHosted ? val.value : val.valueExact, 10);
      if (!acc[address]) acc[address] = 0;
      acc[address] += value;
      return acc;
    },
    {}
  );
}
