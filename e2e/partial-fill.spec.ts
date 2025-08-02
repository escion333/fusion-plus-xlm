import { test, expect } from '@playwright/test';

test('partial fill flow', async ({ page }) => {
  // Navigate to the app
  await page.goto('http://localhost:3000');
  
  // Click connect wallet button
  await page.click('text=Connect Wallet');
  
  // Wait for wallet modal and select MetaMask
  await page.waitForSelector('text=MetaMask');
  await page.click('text=MetaMask');
  
  // Fill in swap amount
  await page.fill('input[placeholder="0.0"]', '1');
  
  // Click swap button
  await page.click('button:has-text("Swap")');
  
  // Wait for progress modal
  await page.waitForSelector('text=Swap Progress');
  
  // Check initial progress (0%)
  const progressBar = page.locator('[role="progressbar"]');
  await expect(progressBar).toHaveAttribute('aria-valuenow', '0');
  
  // Wait for first partial fill (40%)
  await expect(progressBar).toHaveAttribute('aria-valuenow', '40', { timeout: 60000 });
  
  // Wait for second partial fill (100%)
  await expect(progressBar).toHaveAttribute('aria-valuenow', '100', { timeout: 120000 });
  
  // Verify completion message
  await expect(page.locator('text=Swap Complete!')).toBeVisible();
  
  // Check for transaction links
  await expect(page.locator('a:has-text("View on Explorer")')).toHaveCount(2);
});