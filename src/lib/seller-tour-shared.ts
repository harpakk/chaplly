export type SellerTourName = "sidebar" | "product" | "design";

export type SellerTourState = {
  eligible: boolean;
  loginCount: number;
  dismissedLoginCount: number | null;
  dontShowAgain: boolean;
  steps: Record<SellerTourName, number>;
  completed: Record<SellerTourName, boolean>;
};

export function shouldAutoShowSellerTour(state: SellerTourState, tour: SellerTourName) {
  return state.eligible &&
    state.loginCount > 0 &&
    state.loginCount <= 3 &&
    state.dismissedLoginCount !== state.loginCount &&
    !state.dontShowAgain &&
    !state.completed[tour];
}
