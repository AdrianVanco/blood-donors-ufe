import { newE2EPage } from '@stencil/core/testing';

describe('cv2xvancoa-blood-donors', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<cv2xvancoa-blood-donors></cv2xvancoa-blood-donors>');

    const element = await page.find('cv2xvancoa-blood-donors');
    expect(element).toHaveClass('hydrated');
  });
});
