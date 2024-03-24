import { useSubscription } from 'urql';
import { useAccount, useWriteContract } from 'wagmi';
import { Card, CardContent, CardFooter, CardHeader } from '../ui/card';
import classNames from 'classnames';
import { graphql } from '@/graphql';
import { Address, formatEther } from 'viem';
import { connection } from '@/lib/pyth';
import * as tradePairAbi from '@/abi/TradePair.json';
import { Button } from '../ui/button';
import {
  formatDynamicPrecisionPrice,
  mapMarketToAssetPath,
  mapMarketToPriceFeedId,
  mapMarketToTradePairAddress,
  mapTradePairAddressToMarket,
} from '@/lib/utils';
import { Market } from '@/types';
import { Asset } from '../Asset';
import { PRICE_PRECISION } from '@/lib/constants';

function formatUSD(value: bigint): string {
  return (
    '$' +
    Intl.NumberFormat()
      .format(BigInt(formatEther(value)))
      .toString()
  );
}

const openPositionsSubscription = graphql(/* GraphQL */ `
  subscription getPositions($owner: String!) {
    Position(where: { owner: { address: { _eq: $owner } }, isOpen: { _eq: true } }) {
      collateral
      direction
      entryVolume
      entryPrice
      entryTimestamp
      id
      tradePair_id
      tradePair {
        name
      }
    }
  }
`);

interface PositionProps {
  id: string;
  size: number;
  collateral: number;
  entryPrice: number;
  isLong: boolean;
  market: Market;
  pairName: string;
}

const Position = ({
  id,
  size,
  collateral,
  entryPrice,
  isLong,
  market,
  pairName,
}: PositionProps) => {
  const { writeContract } = useWriteContract();

  const leverage = Number(size) / Number(collateral);

  const handleClose = async () => {
    const priceFeedId = mapMarketToPriceFeedId(market);
    const priceFeedUpdateData = await connection.getPriceFeedsUpdateData([priceFeedId]);
    const tradePairAddress = mapMarketToTradePairAddress(market);

    writeContract({
      address: tradePairAddress,
      abi: tradePairAbi.abi,
      functionName: 'closePosition',
      args: [id, priceFeedUpdateData],
      value: 1n,
    });
  };

  return (
    <Card className="bg-glass/20 backdrop-blur-md rounded-md">
      <CardHeader
        className={classNames('rounded-t-md p-0', {
          'bg-constructive/70': isLong,
          'bg-destructive/70': !isLong,
        })}
      >
        <p className="ml-4">{isLong ? 'long' : 'short'}</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 pt-6">
          <div className="mb-4">
            <Asset asset={{ key: pairName, value: pairName }} path={mapMarketToAssetPath(market)} />
          </div>
          <div className="flex justify-between">
            <p>Collateral:</p>
            <p>{formatUSD(BigInt(collateral))}</p>
          </div>
          <div className="flex justify-between">
            <p>Leverage:</p>
            <p>{leverage}x</p>
          </div>
          <div className="flex justify-between">
            <p>Size:</p>
            <p>{formatUSD(BigInt(size))}</p>
          </div>
          <div className="flex justify-between">
            <p>Entry Price:</p>
            <p>${formatDynamicPrecisionPrice(Number(entryPrice) / PRICE_PRECISION)}</p>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button size="default" fontSize="sm" onClick={handleClose}>
          Close
        </Button>
      </CardFooter>
    </Card>
  );
};

export function OpenPositionList() {
  const { address, status } = useAccount();

  const [result] = useSubscription({
    query: openPositionsSubscription,
    variables: { owner: address || '' },
    pause: !address,
  });

  if (status !== 'connected') {
    return (
      <div className="flex justify-center px-6 pt-8">
        Connect your wallet to see your open positions.
      </div>
    );
  }

  const { data, fetching } = result;

  if (fetching) return <div>Loading...</div>;

  return (
    <div className="h-full p-6">
      <div className="flex flex-col space-y-4">
        {data && data.Position.length !== 0 ? (
          data.Position.map(position => (
            <Position
              key={position.id}
              id={position.id}
              size={position.entryVolume}
              collateral={position.collateral}
              entryPrice={position.entryPrice}
              isLong={position.direction === 1}
              market={mapTradePairAddressToMarket(position.tradePair_id as Address)}
              pairName={position.tradePair?.name || ''}
            />
          ))
        ) : (
          <div className="px-4 py-8">No open positions.</div>
        )}
      </div>
    </div>
  );
}
