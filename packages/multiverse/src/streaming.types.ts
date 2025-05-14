// Define types for our test data
export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Purchase {
  id: number;
  userId: number;
  productName: string;
  price: number;
  date: string;
}

// Server-side types (snake_case)
export interface ServerUser {
  id: number;
  user_name: string;
  user_email: string;
}

export interface ServerPurchase {
  id: number;
  user_id: number;
  product_name: string;
  product_price: number;
  purchase_date: string;
}
