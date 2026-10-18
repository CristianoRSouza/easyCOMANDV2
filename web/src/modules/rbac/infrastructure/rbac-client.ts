import { manageRbac, type RbacAction } from "./rbac.functions";

// useServerFn-friendly typed wrapper around the dispatch server fn.
export async function callRbac<T = unknown>(input: RbacAction): Promise<T> {
  return (await manageRbac({ data: input })) as T;
}
