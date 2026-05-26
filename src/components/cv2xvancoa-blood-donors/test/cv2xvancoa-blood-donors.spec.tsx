import { newSpecPage } from '@stencil/core/testing';
import { Cv2xvancoaBloodDonors } from '../cv2xvancoa-blood-donors';

describe('cv2xvancoa-blood-donors', () => {

  // --- Pracovník (worker) flow ---

  it('pracovník: renders full editor on /entry/', async () => {
    const page = await newSpecPage({
      url: `http://localhost/entry/@new`,
      components: [Cv2xvancoaBloodDonors],
      html: `<cv2xvancoa-blood-donors base-path="/" role="pracovnik"></cv2xvancoa-blood-donors>`,
    });
    page.win.navigation = new EventTarget()
    const child = page.root.shadowRoot.querySelector('cv2xvancoa-blood-donors-editor');
    expect(child).not.toBeNull();
    expect(child.getAttribute('mode')).toBe('worker');
  });

  it('pracovník: renders donor list by default', async () => {
    const page = await newSpecPage({
      url: `http://localhost/blood-donors/`,
      components: [Cv2xvancoaBloodDonors],
      html: `<cv2xvancoa-blood-donors base-path="/blood-donors/" role="pracovnik"></cv2xvancoa-blood-donors>`,
    });
    page.win.navigation = new EventTarget()
    const child = page.root.shadowRoot.querySelector('cv2xvancoa-blood-donors-list');
    expect(child).not.toBeNull();
  });

  it('pracovník: nemá vlastný profil/rezerváciu -> presmerovanie na zoznam', async () => {
    const page = await newSpecPage({
      url: `http://localhost/blood-donors/profile`,
      components: [Cv2xvancoaBloodDonors],
      html: `<cv2xvancoa-blood-donors base-path="/blood-donors/" role="pracovnik"></cv2xvancoa-blood-donors>`,
    });
    page.win.navigation = new EventTarget()
    expect(page.root.shadowRoot.querySelector('cv2xvancoa-blood-donors-list')).not.toBeNull();
    expect(page.root.shadowRoot.querySelector('cv2xvancoa-blood-donors-profile')).toBeNull();
  });

  // --- Darca (donor) flow ---

  it('darca: lands on own profile by default (no donor list)', async () => {
    const page = await newSpecPage({
      url: `http://localhost/blood-donors/`,
      components: [Cv2xvancoaBloodDonors],
      html: `<cv2xvancoa-blood-donors base-path="/blood-donors/" role="darca"></cv2xvancoa-blood-donors>`,
    });
    page.win.navigation = new EventTarget()
    expect(page.root.shadowRoot.querySelector('cv2xvancoa-blood-donors-profile')).not.toBeNull();
    expect(page.root.shadowRoot.querySelector('cv2xvancoa-blood-donors-list')).toBeNull();
  });

  it('darca: full worker editor (/entry/) is guarded -> redirected away', async () => {
    const page = await newSpecPage({
      url: `http://localhost/blood-donors/entry/123`,
      components: [Cv2xvancoaBloodDonors],
      html: `<cv2xvancoa-blood-donors base-path="/blood-donors/" role="darca"></cv2xvancoa-blood-donors>`,
    });
    page.win.navigation = new EventTarget()
    const editor = page.root.shadowRoot.querySelector('cv2xvancoa-blood-donors-editor');
    // darca nesmie otvoriť plný editor ľubovoľného darcu -> presmerovanie na profil
    expect(editor).toBeNull();
    expect(page.root.shadowRoot.querySelector('cv2xvancoa-blood-donors-profile')).not.toBeNull();
  });

  it('darca: self-edit editor renders in donor mode', async () => {
    const page = await newSpecPage({
      url: `http://localhost/blood-donors/self/123`,
      components: [Cv2xvancoaBloodDonors],
      html: `<cv2xvancoa-blood-donors base-path="/blood-donors/" role="darca"></cv2xvancoa-blood-donors>`,
    });
    page.win.navigation = new EventTarget()
    const editor = page.root.shadowRoot.querySelector('cv2xvancoa-blood-donors-editor');
    expect(editor).not.toBeNull();
    expect(editor.getAttribute('mode')).toBe('donor');
  });
});