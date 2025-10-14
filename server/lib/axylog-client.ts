import axios from 'axios';

const AUTH_URL = 'https://api.axylog.com/authentication/service';
const BASE_URL = 'https://api.axylog.com';

interface AxylogCredentials {
  token: string;
  userId: string;
  companyId: string;
  contextOwnerId: string;
}

export interface AxylogFile {
  // Handle both API response formats
  fileName?: string;
  filename?: string;
  fileExtension?: string;
  extension?: string;
  type?: string;
  tag?: string;
  downloadUrl?: string;
  url?: string;
  thumbnailBase64?: string;
  [key: string]: any;
}

export class AxylogClient {
  private credentials: AxylogCredentials | null = null;
  private username: string;
  private password: string;

  constructor() {
    this.username = process.env.AXYLOG_USERNAME || '';
    this.password = process.env.AXYLOG_PASSWORD || '';
    
    if (!this.username || !this.password) {
      console.warn('⚠️ Axylog credentials not found in environment variables');
    }
  }

  async authenticate(): Promise<boolean> {
    try {
      if (this.credentials) {
        return true;
      }

      if (!this.username || !this.password) {
        console.error('❌ Missing Axylog credentials');
        return false;
      }

      const response = await axios.post(AUTH_URL, {
        username: this.username,
        password: this.password
      });

      const { token, userTree } = response.data;
      this.credentials = {
        token,
        userId: userTree.userId,
        companyId: userTree.companiesOwners[0].company,
        contextOwnerId: userTree.companiesOwners[0].contextOwner
      };

      console.log('✅ Authenticated with Axylog API');
      return true;
    } catch (error) {
      console.error('❌ Failed to authenticate with Axylog:', error);
      return false;
    }
  }

  async getFiles(year: number, code: number, prog: number): Promise<AxylogFile[]> {
    try {
      const authenticated = await this.authenticate();
      if (!authenticated || !this.credentials) {
        throw new Error('Not authenticated');
      }

      const filesUrl = `${BASE_URL}/deliveries/${year}/${code}/${prog}/files`;
      
      const response = await axios.get(filesUrl, {
        headers: {
          'Authorization': `Bearer ${this.credentials.token}`,
          'Content-Type': 'application/json',
          'User': this.credentials.userId,
          'Company': this.credentials.companyId,
          'ContextOwner': this.credentials.contextOwnerId,
          'SourceDeviceType': '3',
          'LanguageCode': 'EN'
        }
      });

      return response.data || [];
    } catch (error: any) {
      console.error(`❌ Error fetching files for ${year}/${code}/${prog}:`, error.message);
      return [];
    }
  }

  normalizeFile(file: AxylogFile): {
    filename: string;
    extension: string;
    url?: string;
    thumbnailBase64?: string;
    tag?: string;
  } {
    // Normalize field names from different API formats
    const filename = file.filename || file.fileName || '';
    const extension = file.extension || file.fileExtension || '';
    const url = file.url || file.downloadUrl;
    const thumbnailBase64 = file.thumbnailBase64;
    const tag = file.tag || file.type;

    return {
      filename,
      extension,
      url,
      thumbnailBase64,
      tag,
    };
  }

  isPhoto(file: AxylogFile): boolean {
    const normalized = this.normalizeFile(file);
    
    // Check by tag/type
    if (normalized.tag === 'photo' || normalized.tag === 'Delivery outcome image' || normalized.tag === 'Pickup outcome image') {
      return true;
    }
    
    // Check by extension
    const ext = normalized.extension.toLowerCase();
    const photoExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'];
    
    if (photoExtensions.includes(ext)) {
      return true;
    }

    // Check filename extension
    const filename = normalized.filename.toLowerCase();
    return photoExtensions.some(e => filename.endsWith(`.${e}`));
  }

  filterPhotos(files: AxylogFile[]): AxylogFile[] {
    return files.filter(file => this.isPhoto(file));
  }
}

export const axylogClient = new AxylogClient();
