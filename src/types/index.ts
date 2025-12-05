export interface User {
  id: string;
  email: string;
  fullName?: string;
  phone?: string;
  role: 'CUSTOMER' | 'RESTAURANT' | 'DRIVER' | 'ADMIN';
  status: string;
  customer?: Customer;
}

export interface Customer {
  id: string;
  fullName: string;
  cpf?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  coverUrl?: string;
  phone?: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  isOpen: boolean;
  rating: number;
  ratingCount: number;
  minOrderValue: number;
  deliveryFee: number;
  avgPrepTime: number;
  categories: { category: Category }[];
}

export interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  items: MenuItem[];
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
}

export interface Order {
  id: string;
  orderNumber: number;
  status: string;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  paymentMethod: string;
  notes?: string;
  createdAt: string;
  restaurant?: Restaurant;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  menuItem?: MenuItem;
}

export interface Address {
  id?: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  isDefault?: boolean;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  address?: Address;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
