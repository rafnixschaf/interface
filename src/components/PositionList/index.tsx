import { gql, useQuery } from 'urql';
import { useAccount } from 'wagmi';

const UserPositionsQuery = gql`
  query UserPositions($owner: String!) {
    Position(where: { owner: { _eq: $owner } }) {
      collateral
      id
    }
  }
`;

export function PositionList() {
  const { address, status } = useAccount();

  const [result] = useQuery({
    query: UserPositionsQuery,
    variables: { owner: address },
  });

  if (status !== 'connected') {
    return <div>Connect your wallet to see your positions</div>;
  }

  const { data, fetching, error } = result;

  if (fetching) return <div>Loading...</div>;

  if (error) return <div>Error: {(error as BaseError).shortMessage || error.message || error}</div>;

  console.log(data);

  return <div>data: {data?.toString()}</div>;
}

