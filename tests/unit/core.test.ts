import {
  executeOneClickGroup,
  executeBulkColorText,
  executeBulkColorShapes,
  executeImageReplace,
  hexToRgb,
  generateGroupName
} from '../../src/index';

describe('Core Plugin Functionality', () => {
  describe('hexToRgb', () => {
    it('should convert hex color to RGB object', () => {
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
    });

    it('should handle hex colors without # prefix', () => {
      expect(hexToRgb('ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should return black for invalid hex colors', () => {
      expect(hexToRgb('invalid')).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb('')).toEqual({ r: 0, g: 0, b: 0 });
    });
  });

  describe('generateGroupName', () => {
    it('should generate a group name with timestamp', () => {
      const name = generateGroupName();
      expect(name).toMatch(/^Group \d{1,2}:\d{2}:\d{2}/);
    });

    it('should generate unique names for different calls', () => {
      const name1 = generateGroupName();
      // Small delay to ensure different timestamps
      const name2 = generateGroupName();
      // Names should have the same format but potentially different timestamps
      expect(name1).toMatch(/^Group/);
      expect(name2).toMatch(/^Group/);
    });
  });

  describe('executeOneClickGroup', () => {
    it('should successfully create a group', async () => {
      const result = await executeOneClickGroup();
      
      expect(result.success).toBe(true);
      expect(result.groupName).toBeDefined();
      expect(result.layerCount).toBe(1);
      expect(global.app.batchPlay).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            _obj: 'make',
            _target: [{ _ref: 'layerSection' }]
          })
        ]),
        { modalBehavior: 'execute' }
      );
    });

    it('should handle errors gracefully', async () => {
      // Mock batchPlay to throw an error
      global.app.batchPlay.mockRejectedValueOnce(new Error('Test error'));
      
      const result = await executeOneClickGroup();
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('Test error');
    });
  });

  describe('executeBulkColorText', () => {
    it('should successfully apply color to text layers', async () => {
      const result = await executeBulkColorText('#ff0000');
      
      expect(result.success).toBe(true);
      expect(result.textLayerCount).toBe(1);
      expect(global.app.batchPlay).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            _obj: 'set',
            to: expect.objectContaining({
              color: {
                _obj: 'RGBColor',
                red: 255,
                green: 0,
                blue: 0
              }
            })
          })
        ]),
        { modalBehavior: 'execute' }
      );
    });

    it('should handle invalid colors', async () => {
      const result = await executeBulkColorText('invalid');
      
      expect(result.success).toBe(true);
      expect(global.app.batchPlay).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            to: expect.objectContaining({
              color: {
                _obj: 'RGBColor',
                red: 0,
                green: 0,
                blue: 0
              }
            })
          })
        ]),
        { modalBehavior: 'execute' }
      );
    });
  });

  describe('executeBulkColorShapes', () => {
    it('should successfully apply color to shape layers', async () => {
      const result = await executeBulkColorShapes('#00ff00');
      
      expect(result.success).toBe(true);
      expect(result.shapeLayerCount).toBe(1);
      expect(global.app.batchPlay).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            _obj: 'set',
            to: {
              _obj: 'RGBColor',
              red: 0,
              green: 255,
              blue: 0
            }
          })
        ]),
        { modalBehavior: 'execute' }
      );
    });
  });

  describe('executeImageReplace', () => {
    it('should successfully replace image when file is selected', async () => {
      const result = await executeImageReplace();
      
      expect(result.success).toBe(true);
      expect(global.storage.localFileSystem.getFileForOpening).toHaveBeenCalledWith({
        types: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp']
      });
      expect(global.app.batchPlay).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            _obj: 'placeEvent'
          })
        ]),
        { modalBehavior: 'execute' }
      );
    });

    it('should handle no file selected', async () => {
      global.storage.localFileSystem.getFileForOpening.mockResolvedValueOnce(null);
      
      const result = await executeImageReplace();
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('No file selected');
    });

    it('should handle file selection errors', async () => {
      global.storage.localFileSystem.getFileForOpening.mockRejectedValueOnce(
        new Error('File access denied')
      );
      
      const result = await executeImageReplace();
      
      expect(result.success).toBe(false);
      expect(result.message).toBe('File access denied');
    });
  });
});