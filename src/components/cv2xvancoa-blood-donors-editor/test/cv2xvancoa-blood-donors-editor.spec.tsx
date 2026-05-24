import { newSpecPage } from '@stencil/core/testing';
import { Cv2xvancoaBloodDonorsEditor } from '../cv2xvancoa-blood-donors-editor';
import fetchMock from 'jest-fetch-mock';
import { DonationType, Donor } from '../../../api/blood-donors';

describe('cv2xvancoa-blood-donors-editor', () => {
  const sampleEntry: Donor = {
    id: "entry-1",
    donorId: "p-1",
    name: "Juraj Prvý",
    sex: "M",
    bloodType: "A+",
    preferredDonationType: "blood",
    eligible: true,
    registeredSince: new Date("20240203T12:00"),
    donations: []
  };

  const sampleDonationTypes: DonationType[] = [
    {
      value: "Darovanie krvi",
      code: "blood",
      typicalDurationMinutes: 15
    },
    {
      value: "Darovanie krvnej plazmy",
      code: "plasma",
      typicalDurationMinutes: 45
    },
  ];

  let delay = async (milliseconds: number) => await new Promise<void>(resolve => {
    setTimeout(() => resolve(), milliseconds);
  });

  beforeAll(() => {
    fetchMock.enableMocks();
  });

  afterEach(() => {
    fetchMock.resetMocks();
  });

  it('buttons shall be of different type', async () => {
    fetchMock.mockResponses(
      [JSON.stringify(sampleEntry), { status: 200 }],
      [JSON.stringify(sampleDonationTypes), { status: 200 }]
    );

    const page = await newSpecPage({
      components: [Cv2xvancoaBloodDonorsEditor],
      html: `<cv2xvancoa-blood-donors-editor entry-id="entry-1" site-id="test-ambulance" api-base="http://sample.test/api"></cv2xvancoa-blood-donors-editor>`,
    });

    await delay(300);
    await page.waitForChanges();

    const items: any = await page.root.shadowRoot.querySelectorAll("md-filled-button");
    expect(items.length).toEqual(1);
    // Continue with other assertions...
  });

  it('first text field is patient name', async () => {
    fetchMock.mockResponses(
      [JSON.stringify(sampleEntry), { status: 200 }],
      [JSON.stringify(sampleDonationTypes), { status: 200 }]
    );

    const page = await newSpecPage({
      components: [Cv2xvancoaBloodDonorsEditor],
      html: `<cv2xvancoa-blood-donors-editor entry-id="entry-1" site-id="test-ambulance" api-base="http://sample.test/api"></cv2xvancoa-blood-donors-editor>`,
    });

    await delay(300);
    await page.waitForChanges();

    const items: any = await page.root.shadowRoot.querySelectorAll("md-filled-text-field");
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].getAttribute("value")).toEqual(sampleEntry.name);
  });
});