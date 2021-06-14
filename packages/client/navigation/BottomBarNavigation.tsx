/**
 * Learn more about createBottomTabNavigator:
 * https://reactnavigation.org/docs/bottom-tab-navigator
 */

import { Ionicons } from '@expo/vector-icons';
import {
    BottomTabBarProps,
    createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import React, { useState } from 'react';
import { View, Text, useSx } from 'dripsy';
import { TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ColorModeProps } from '.';
import { tabStyle } from '../constants/Colors';
import HomeScreen from '../screens/HomeScreen';
import SearchTrackScreen from '../screens/SearchTrackScreen';
import SearchTrackResultsScreen from '../screens/SearchTrackResultsScreen';
import {
    BottomTabNavigatorParamList,
    HomeParamsList,
    SearchTracksParamsList,
} from '../types';
import TheMusicPlayer from '../components/TheMusicPlayer';

const Tab = createBottomTabNavigator<BottomTabNavigatorParamList>();

/**
 * See https://reactnavigation.org/docs/bottom-tab-navigator#tabbar.
 */
function MyTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const [fullscreenPlayer, setFullscreenPlayer] = useState(false);

    const insets = useSafeAreaInsets();
    const sx = useSx();
    const focusedOptions = descriptors[state.routes[state.index].key].options;

    if (focusedOptions.tabBarVisible === false) {
        return null;
    }

    const greyLighter = sx({ backgroundColor: 'greyLighter' })
        .backgroundColor as string;

    return (
        <>
            <TheMusicPlayer
                isFullScreen={fullscreenPlayer}
                setIsFullScren={setFullscreenPlayer}
            />

            <View
                sx={{
                    backgroundColor: 'greyLight',

                    paddingBottom: insets.bottom,
                    paddingLeft: insets.left,
                    paddingRight: insets.right,
                    zIndex: 10,
                }}
            >
                <View sx={{ flexDirection: 'row' }}>
                    {state.routes.map((route, index) => {
                        const { options } = descriptors[route.key];
                        const label =
                            options.tabBarLabel !== undefined
                                ? options.tabBarLabel
                                : options.title !== undefined
                                ? options.title
                                : route.name;
                        const icon = options.tabBarIcon;
                        if (icon === undefined) {
                            throw new Error(
                                `An icon must be set for screen ${route.name}`,
                            );
                        }

                        const isFocused = state.index === index;

                        const onPress = () => {
                            const event = navigation.emit({
                                type: 'tabPress',
                                target: route.key,
                                canPreventDefault: true,
                            });

                            if (!isFocused && !event.defaultPrevented) {
                                navigation.navigate(route.name);
                            }
                        };

                        const onLongPress = () => {
                            navigation.emit({
                                type: 'tabLongPress',
                                target: route.key,
                            });
                        };

                        return (
                            <TouchableOpacity
                                key={route.name}
                                accessibilityRole="button"
                                accessibilityState={
                                    isFocused ? { selected: true } : {}
                                }
                                accessibilityLabel={
                                    options.tabBarAccessibilityLabel
                                }
                                testID={options.tabBarTestID}
                                onPress={onPress}
                                onLongPress={onLongPress}
                                style={{ flex: 1 }}
                            >
                                <View
                                    sx={{
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        paddingTop: 'm',
                                    }}
                                >
                                    {icon({
                                        color: isFocused
                                            ? 'white'
                                            : greyLighter,
                                        focused: isFocused,
                                        size: 24,
                                    })}

                                    <Text
                                        sx={{
                                            color: isFocused
                                                ? 'white'
                                                : 'greyLighter',
                                            marginTop: 'm',
                                            fontSize: 'xs',
                                        }}
                                    >
                                        {label}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        </>
    );
}

const BottomTab: React.FC<ColorModeProps> = ({ colorScheme }) => {
    const style = tabStyle(colorScheme);
    console.log(colorScheme);
    return (
        <Tab.Navigator
            initialRouteName="Home"
            tabBarOptions={{ ...style }}
            tabBar={(props) => <MyTabBar {...props} />}
        >
            <Tab.Screen
                name="Home"
                component={TabOneNavigator}
                options={{
                    tabBarIcon: (props) => (
                        <TabBarIcon name="home" {...props} />
                    ),
                }}
            />
            <Tab.Screen
                name="Search"
                component={TabTwoNavigator}
                options={{
                    tabBarIcon: (props) => (
                        <TabBarIcon name="search" {...props} />
                    ),
                }}
            />
        </Tab.Navigator>
    );
};

// You can explore the built-in icon families and icons on the web at:
// https://icons.expo.fyi/
function TabBarIcon(props: {
    name: React.ComponentProps<typeof Ionicons>['name'];
    color: string;
    size: number;
}) {
    return <Ionicons style={{ marginBottom: -3 }} {...props} />;
}

// Each tab has its own navigation stack, you can read more about this pattern here:
// https://reactnavigation.org/docs/tab-based-navigation#a-stack-navigator-for-each-tab
const TabOneStack = createStackNavigator<HomeParamsList>();

function TabOneNavigator() {
    return (
        <TabOneStack.Navigator headerMode={'screen'}>
            <TabOneStack.Screen
                name="HomeX"
                component={HomeScreen}
                options={{ headerTitle: 'Home', headerShown: false }}
            />
        </TabOneStack.Navigator>
    );
}

const TabTwoStack = createStackNavigator<SearchTracksParamsList>();

function TabTwoNavigator() {
    return (
        <TabTwoStack.Navigator headerMode={'none'}>
            <TabTwoStack.Screen
                name="SearchTracks"
                component={SearchTrackScreen}
                options={{ headerTitle: 'Search', headerShown: false }}
            />
            <TabTwoStack.Screen
                name="SearchTrackResults"
                component={SearchTrackResultsScreen}
                options={{ title: 'Results' }}
            />
        </TabTwoStack.Navigator>
    );
}

export default BottomTab;