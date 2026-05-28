export interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  isAvailable?: boolean;
}

export interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void | Promise<void>;
}
