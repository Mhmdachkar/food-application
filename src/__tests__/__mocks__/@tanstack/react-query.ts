export const useQuery = jest.fn(() => ({ data: undefined, isLoading: false, isError: false, refetch: jest.fn() }));
export const useMutation = jest.fn(() => ({ mutate: jest.fn(), mutateAsync: jest.fn(), isLoading: false, isPending: false }));
export const useQueryClient = jest.fn(() => ({
  invalidateQueries: jest.fn(),
  fetchQuery: jest.fn(() => Promise.resolve([])),
  setQueryData: jest.fn(),
  getQueryData: jest.fn(),
}));
export const QueryClient = jest.fn().mockImplementation(() => ({
  defaultOptions: {},
  invalidateQueries: jest.fn(),
  fetchQuery: jest.fn(() => Promise.resolve([])),
}));
export const QueryClientProvider = ({ children }: { children: React.ReactNode }) => children;
