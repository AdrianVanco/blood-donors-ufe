import { newE2EPage } from '@stencil/core/testing';

describe('cv2xvancoa-blood-donors-editor', () => {
  it('renders', async () => {
    const page = await newE2EPage();
    await page.setContent('<cv2xvancoa-blood-donors-editor></cv2xvancoa-blood-donors-editor>');

    const element = await page.find('cv2xvancoa-blood-donors-editor');
    expect(element).toHaveClass('hydrated');
  });
});
