import { newSpecPage } from '@stencil/core/testing';
import { Cv2xvancoaBloodDonors } from '../cv2xvancoa-blood-donors';

describe('cv2xvancoa-blood-donors', () => {

  it('renders editor', async () => {
    const page = await newSpecPage({
      url: `http://localhost/entry/@new`,
      components: [Cv2xvancoaBloodDonors],
      html: `<cv2xvancoa-blood-donors base-path="/"></cv2xvancoa-blood-donors>`,
    });
    page.win.navigation = new EventTarget()
    const child = await page.root.shadowRoot.firstElementChild;
    expect(child.tagName.toLocaleLowerCase()).toEqual ("cv2xvancoa-blood-donors-editor");

  });

  it('renders list', async () => {
    const page = await newSpecPage({
      url: `http://localhost/blood-donors/`,
      components: [Cv2xvancoaBloodDonors],
      html: `<cv2xvancoa-blood-donors base-path="/blood-donors/"></cv2xvancoa-blood-donors>`,
    });
    page.win.navigation = new EventTarget()
    const child = await page.root.shadowRoot.firstElementChild;
    expect(child.tagName.toLocaleLowerCase()).toEqual("cv2xvancoa-blood-donors-list");
  });
});