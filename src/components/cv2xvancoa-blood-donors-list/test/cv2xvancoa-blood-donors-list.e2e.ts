import { newE2EPage } from '@stencil/core/testing';

describe('cv2xvancoa-blood-donors-list', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<cv2xvancoa-blood-donors-list></cv2xvancoa-blood-donors-list>');

    const element = await page.find('cv2xvancoa-blood-donors-list');
    expect(element).toHaveClass('hydrated');
  });
});
