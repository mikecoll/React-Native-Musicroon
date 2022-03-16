import { test, expect } from '@playwright/test';
import { internet } from 'faker';
import { mockSearchTracks } from './_utils/mock-http';
import { knownSearches, pageIsOnHomeScreen } from './_utils/mpe-e2e-utils';
import { GEOLOCATION_POSITIONS } from './_utils/page';

test('Signs up a user, expects to be redirected to home and to be still loggged in on another page or after a refresh', async ({
    browser,
}) => {
    const context = await browser.newContext({
        permissions: ['geolocation'],
        geolocation: GEOLOCATION_POSITIONS['Manosque, France'],
    });
    await mockSearchTracks({
        context: context,
        knownSearches,
    });

    const page = await context.newPage();
    await page.goto('/');

    await expect(page.locator('text="Welcome back Popol!"')).toBeVisible();

    await page.click('text="Or sign up ?"');

    await expect(page.locator('text="To party sign up !"')).toBeVisible();

    await page.fill('[placeholder="Your nickname"]', internet.userName());
    await page.fill('[placeholder="Your email"]', internet.email());
    await page.fill('[placeholder="Your password"]', 'adfg=1435&*&*(SjhgA');

    await page.click('text="Sign Up"');

    await pageIsOnHomeScreen({ page });

    await page.reload();

    await pageIsOnHomeScreen({ page });

    const newTab = await context.newPage();
    await newTab.goto('/');

    await pageIsOnHomeScreen({ page: newTab });
});