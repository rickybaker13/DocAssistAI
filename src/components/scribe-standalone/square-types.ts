declare global {
  interface Window {
    Square?: {
      payments: (appId: string, locationId: string) => Promise<SquarePayments>;
    };
  }
}

export interface SquarePayments {
  card: () => Promise<SquareCard>;
  ach: () => Promise<SquareAch>;
  applePay: (paymentRequest: SquarePaymentRequest) => Promise<SquareDigitalWallet>;
  googlePay: (paymentRequest: SquarePaymentRequest) => Promise<SquareDigitalWallet>;
}

export interface SquareCard {
  attach: (selector: string) => Promise<void>;
  destroy: () => Promise<void>;
  tokenize: () => Promise<SquareTokenResult>;
}

export interface SquareAch {
  tokenize: (options: {
    accountHolderName: string;
    intent: 'CHARGE' | 'STORE';
    total: { amount: number; currencyCode: string };
  }) => Promise<SquareTokenResult>;
  destroy: () => Promise<void>;
}

export interface SquareDigitalWallet {
  attach: (selector: string) => Promise<void>;
  destroy: () => Promise<void>;
  tokenize: () => Promise<SquareTokenResult>;
}

export interface SquarePaymentRequest {
  countryCode: string;
  currencyCode: string;
  total: { amount: string; label: string };
}

export interface SquareTokenResult {
  status: string;
  token?: string;
  errors?: Array<{ message?: string }>;
}

export interface SquareConfigResponse {
  appId: string | null;
  locationId: string | null;
  accessTokenConfigured?: boolean;
  environment?: 'sandbox' | 'production';
  enabled: boolean;
}
