import type { NavigatorScreenParams } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

export type MainTabParamList = {
  Home: undefined;
  Market: undefined;
  Garage: undefined;
  Automation: undefined;
  Staff: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Main: undefined;
  VehicleDetail: { scope: "aggregated" | "listing"; id: string };
  CreateListing: undefined;
  Platforms: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type RootNavParams = NavigatorScreenParams<RootStackParamList>;
