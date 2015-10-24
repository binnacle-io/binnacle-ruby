require 'spec_helper'

describe Binnacle::Configuration do

  describe 'initialize' do

    it 'can be configured via ENV variables' do
      ENV['BINNACLE_ENDPOINT'] = '127.0.0.1'
      ENV['BINNACLE_PORT'] = '8080'
      ENV['BINNACLE_APP_LOG_CTX'] = 'icoc0tnol3obe8pas207'
      ENV['BINNACLE_APP_ERR_CTX'] = 'id0czm8eryfffcgp875c'
      ENV['BINNACLE_API_KEY'] = 'vceth4xcwqfoowpz2esi'
      ENV['BINNACLE_API_SECRET'] = '1grttyb8ozbe9axt88ji'
      ENV['BINNACLE_RAILS_LOG'] = 'TRUE'
      ENV['BINNACLE_REPORT_EXCEPTIONS'] = 'TRUE'
      ENV['BINNACLE_IGNORED_EXCEPTIONS'] = 'ZeroDivisionError'
      ENV['BINNACLE_RAILS_LOG_ASYNCH'] = 'TRUE'
      ENV['BINNACLE_ENCRYPTED'] = 'TRUE'

      config = Binnacle::Configuration.new
      
      expect(config.endpoint).to eq '127.0.0.1'
      expect(config.port).to eq '8080'
      expect(config.logging_ctx).to eq 'icoc0tnol3obe8pas207'
      expect(config.error_ctx).to eq 'id0czm8eryfffcgp875c'
      expect(config.api_key).to eq 'vceth4xcwqfoowpz2esi'
      expect(config.api_secret).to eq '1grttyb8ozbe9axt88ji'
      expect(config.intercept_rails_logging).to be true
      expect(config.report_exceptions).to be true
      expect(config.ignored_exceptions).to include('ZeroDivisionError')
      expect(config.encrypted).to be true
      expect(config.asynch_logging).to be true
    end

    it 'configures urls given one endpoint' do
      config = Binnacle::Configuration.new
      config.endpoint = '127.0.0.1'

      expect(config.url).to eq('https://127.0.0.1:8080')
    end

    it 'configures urls given multiple endpoints' do
      config = Binnacle::Configuration.new
      config.endpoint = ['127.0.0.1', 'localhost', '192.168.0.1']

      expect(config.urls).to include('https://127.0.0.1:8080', 'https://localhost:8080', 'https://192.168.0.1:8080')
    end

    it 'urls use HTTP is the encrypted flag is false' do
      config = Binnacle::Configuration.new
      config.endpoint = '127.0.0.1'
      config.encrypted = false

      expect(config.url).to eq('http://127.0.0.1:8080')
    end

  end

end
