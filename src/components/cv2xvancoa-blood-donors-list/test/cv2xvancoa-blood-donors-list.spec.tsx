import { newSpecPage } from '@stencil/core/testing';
import { Cv2xvancoaBloodDonorsList } from '../cv2xvancoa-blood-donors-list';
import { Donor } from '../../../api/blood-donors/models';
import fetchMock from 'jest-fetch-mock';

describe('cv2xvancoa-blood-donors-list', () => {
  const sampleEntries: Donor[] = [
    {
      id: "entry-1",
      donorId: "p-1",
      name: "Juraj Prvý",
      bloodType: "A+",
      registeredSince: new Date("20240203T12:00")
    },
    {
      id: "entry-2",
      donorId: "p-2",
      name: "James Druhý",
      bloodType: "0-",
      registeredSince: new Date("20240203T12:00")
    }
  ];

  beforeAll(() => {
    fetchMock.enableMocks();
  });

  afterEach(() => {
    fetchMock.resetMocks();
  });

  it('renders sample entries', async () => {
    // Mock the API response using sampleEntries
    fetchMock.mockResponseOnce(JSON.stringify(sampleEntries));

    // Set up the page with your component
    const page = await newSpecPage({
      components: [Cv2xvancoaBloodDonorsList],
      html: `<cv2xvancoa-blood-donors-list site-id="test-ambulance" api-base="http://test/api"></cv2xvancoa-blood-donors-list>`,
    });

    const wlList = page.rootInstance as Cv2xvancoaBloodDonorsList;
    const expectedPatients = wlList?.donors?.length;

    // Wait for the DOM to update
    await page.waitForChanges();

    // Query the rendered list items
    const items = page.root.shadowRoot.querySelectorAll("md-list-item");

    // Assert that the expected number of patients and rendered items match the sample entries
    expect(expectedPatients).toEqual(sampleEntries.length);
    expect(items.length).toEqual(expectedPatients);
  });

  it('emits selected entry id when a row is clicked', async () => {
    fetchMock.mockResponseOnce(JSON.stringify(sampleEntries));

    const page = await newSpecPage({
      components: [Cv2xvancoaBloodDonorsList],
      html: `<cv2xvancoa-blood-donors-list site-id="test-ambulance" api-base="http://test/api"></cv2xvancoa-blood-donors-list>`,
    });

    const emittedIds: string[] = [];
    page.root.addEventListener('entry-clicked', (event: CustomEvent<string>) => {
      emittedIds.push(event.detail);
    });

    await page.waitForChanges();

    const items = page.root.shadowRoot.querySelectorAll('md-list-item');
    items[0].dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));

    expect(emittedIds).toEqual(['entry-1']);
  });

  it('renders error message on network issues', async () => {
    // Mock the network error
    fetchMock.mockRejectOnce(new Error('Network Error'));

    const page = await newSpecPage({
      components: [Cv2xvancoaBloodDonorsList],
      html: `<cv2xvancoa-blood-donors-list site-id="test-ambulance" api-base="http://test/api"></cv2xvancoa-blood-donors-list>`,
    });

    const wlList = page.rootInstance as Cv2xvancoaBloodDonorsList;
    const expectedPatients = wlList?.donors?.length;

    // Wait for the DOM to update
    await page.waitForChanges();

    // Query the DOM for error message and list items
    const errorMessage = page.root.shadowRoot.querySelectorAll(".error");
    const items = page.root.shadowRoot.querySelectorAll("md-list-item");

    // Assert that the error message is displayed and no patients are listed
    expect(errorMessage.length).toBeGreaterThanOrEqual(1);
    expect(expectedPatients).toEqual(0);
    expect(items.length).toEqual(expectedPatients);
  });
});
