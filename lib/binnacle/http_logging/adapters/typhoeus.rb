if defined?(Typhoeus)
  require 'uri'

  on_complete = Proc.new do |response|
    request = response.request
    action = request.options[:method] || :get

    uri = URI(request.url)

    content_type = response.headers['Content-Type']
    request_body = request.options[:body]
    encoding = nil

    Binnacle::HttpLogger.signal(request.base_url, action, uri.host, uri.port, uri.path, uri.query, response.response_code, response.total_time, request.options[:params], response.response_body, encoding, content_type, request_body)
  end

  unless Typhoeus.on_complete.include?(on_complete)
    Typhoeus.on_complete << on_complete
  end
end
